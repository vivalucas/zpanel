package storage

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"zpanel/global"
	"zpanel/lib/iniConfig"

	"gopkg.in/ini.v1"
)

func uploadStorageRoot(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	config := ini.Empty()
	config.Section("storage").Key("data_path").SetValue(root)
	oldConfig := global.Config
	global.Config = &iniConfig.IniConfig{Config: config}
	t.Cleanup(func() { global.Config = oldConfig })
	return root
}

func uploadHeader(t *testing.T, name string, body []byte, memory int64) *multipart.FileHeader {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("file", name)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(body); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	form, err := multipart.NewReader(&buf, w.Boundary()).ReadForm(memory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = form.RemoveAll() })
	return form.File["file"][0]
}

func uploadStoredCount(t *testing.T) int {
	t.Helper()
	count := 0
	err := filepath.WalkDir(UploadsPath(), func(_ string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() {
			count++
		}
		return nil
	})
	if err != nil && !os.IsNotExist(err) {
		t.Fatal(err)
	}
	return count
}

func TestPrepareUploadFingerprintsActualBytesWithoutWriting(t *testing.T) {
	uploadStorageRoot(t)
	payload := []byte("exact original image bytes")
	header := uploadHeader(t, "renamed.PNG", payload, 1024)
	header.Size = 1 // The declared metadata is not the source of truth.
	header.Header.Del("Content-Type")
	prepared, err := PrepareUpload(header, []string{".png"})
	if err != nil {
		t.Fatal(err)
	}
	defer prepared.Close()
	sum := sha256.Sum256(payload)
	if prepared.Size != int64(len(payload)) || prepared.SHA256 != hex.EncodeToString(sum[:]) || prepared.Ext != ".png" || prepared.MimeType != "image/png" {
		t.Fatalf("wrong upload fingerprint: %+v", prepared)
	}
	if got := uploadStoredCount(t); got != 0 {
		t.Fatalf("fingerprinting wrote %d upload files", got)
	}
	stored, err := prepared.Store(7, PurposeAttachment, VisibilityPublic)
	if err != nil {
		t.Fatal(err)
	}
	actual, err := os.ReadFile(stored.AbsolutePath)
	if err != nil || !bytes.Equal(actual, payload) {
		t.Fatalf("stored bytes changed: %q, %v", actual, err)
	}
	if matches, err := prepared.Matches(stored.RelativePath); err != nil || !matches {
		t.Fatalf("stored file did not match its fingerprint: %v, %v", matches, err)
	}
}

func TestPrepareUploadEnforcesActualLimitAndAllowedExtensions(t *testing.T) {
	uploadStorageRoot(t)
	for _, size := range []int{DefaultUploadMaxBytes, DefaultUploadMaxBytes + 1} {
		header := uploadHeader(t, "image.png", bytes.Repeat([]byte{'x'}, size), DefaultUploadMaxBytes+1024)
		header.Size = 1
		prepared, err := PrepareUpload(header, []string{".png"})
		if size == DefaultUploadMaxBytes {
			if err != nil {
				t.Fatalf("exact limit rejected: %v", err)
			}
			_ = prepared.Close()
		} else if err == nil || !strings.Contains(err.Error(), "too large") {
			if prepared != nil {
				_ = prepared.Close()
			}
			t.Fatalf("oversized source accepted despite actual size %d: %v", size, err)
		}
	}
	for _, name := range []string{"no-extension", "not-an-image.svg"} {
		if prepared, err := PrepareUpload(uploadHeader(t, name, []byte("x"), 1024), []string{".png"}); err == nil {
			_ = prepared.Close()
			t.Fatalf("invalid extension accepted: %s", name)
		}
	}
	if got := uploadStoredCount(t); got != 0 {
		t.Fatalf("rejected/prepared uploads wrote %d files", got)
	}
}

func TestPreparedUploadRejectsChangedDiskSourceAndCleansPartialObject(t *testing.T) {
	uploadStorageRoot(t)
	// Spill the multipart part to a real file and modify it after fingerprinting.
	// This exercises cleanup after writing, rather than a metadata-only rejection.
	multipartTemp := t.TempDir()
	t.Setenv("TMPDIR", multipartTemp)
	t.Setenv("TEMP", multipartTemp)
	t.Setenv("TMP", multipartTemp)
	prepared, err := PrepareUpload(uploadHeader(t, "image.png", []byte("original bytes"), 0), []string{".png"})
	if err != nil {
		t.Fatal(err)
	}
	defer prepared.Close()
	entries, err := os.ReadDir(multipartTemp)
	if err != nil || len(entries) != 1 {
		t.Fatalf("expected one multipart source file: %v, %v", entries, err)
	}
	if err := os.WriteFile(filepath.Join(multipartTemp, entries[0].Name()), []byte("modified bytes"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := prepared.Store(7, PurposeAttachment, VisibilityPublic); err == nil || !strings.Contains(err.Error(), "changed") {
		t.Fatalf("changed source was stored: %v", err)
	}
	if got := uploadStoredCount(t); got != 0 {
		t.Fatalf("failed upload left %d objects", got)
	}
}

func TestPreparedUploadMatchesRejectsUnsafeAndInvalidObjects(t *testing.T) {
	uploadStorageRoot(t)
	prepared, err := PrepareUpload(uploadHeader(t, "image.png", []byte("original bytes"), 1024), []string{".png"})
	if err != nil {
		t.Fatal(err)
	}
	defer prepared.Close()
	stored, err := prepared.Store(7, PurposeAttachment, VisibilityPublic)
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"../outside.png", stored.AbsolutePath, "missing.png", filepath.Dir(stored.RelativePath)} {
		if matches, err := prepared.Matches(path); err != nil || matches {
			t.Fatalf("invalid candidate %q accepted: %v, %v", path, matches, err)
		}
	}
	if err := os.WriteFile(stored.AbsolutePath, []byte("modified bytes"), 0644); err != nil {
		t.Fatal(err)
	}
	if matches, err := prepared.Matches(stored.RelativePath); err != nil || matches {
		t.Fatalf("same-size damaged object accepted: %v, %v", matches, err)
	}
}

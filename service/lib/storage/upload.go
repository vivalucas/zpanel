package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

// PreparedUpload fingerprints an already parsed multipart file without creating
// an upload object. Its reader must be closed even when an existing file is reused.
type PreparedUpload struct {
	src      multipart.File
	Ext      string
	MimeType string
	Size     int64
	SHA256   string
}

func PrepareUpload(file *multipart.FileHeader, allowedExts []string) (*PreparedUpload, error) {
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		return nil, fmt.Errorf("missing file extension")
	}
	if file.Size > DefaultUploadMaxBytes {
		return nil, fmt.Errorf("file too large: %d bytes", file.Size)
	}
	if len(allowedExts) > 0 && !contains(allowedExts, ext) {
		return nil, fmt.Errorf("unsupported file extension: %s", ext)
	}
	src, err := file.Open()
	if err != nil {
		return nil, err
	}
	hasher := sha256.New()
	size, err := io.Copy(hasher, io.LimitReader(src, DefaultUploadMaxBytes+1))
	if err == nil && size > DefaultUploadMaxBytes {
		err = fmt.Errorf("file too large: %d bytes", size)
	}
	if err != nil {
		_ = src.Close()
		return nil, err
	}
	mimeType := file.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = mime.TypeByExtension(ext)
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
	}
	return &PreparedUpload{src: src, Ext: ext, MimeType: mimeType, Size: size, SHA256: hex.EncodeToString(hasher.Sum(nil))}, nil
}

func (u *PreparedUpload) Close() error { return u.src.Close() }

// Matches verifies the bytes on disk, not just the database fingerprint. A
// missing, replaced, or damaged file must not produce a successful broken URL.
func (u *PreparedUpload) Matches(relativePath string) (bool, error) {
	if !filepath.IsLocal(filepath.FromSlash(relativePath)) {
		return false, nil
	}
	path := AbsolutePath(relativePath)
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if !info.Mode().IsRegular() || info.Size() != u.Size {
		return false, nil
	}
	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	defer f.Close()
	hasher := sha256.New()
	size, err := io.Copy(hasher, io.LimitReader(f, u.Size+1))
	if err != nil {
		return false, err
	}
	return size == u.Size && hex.EncodeToString(hasher.Sum(nil)) == u.SHA256, nil
}

// Store is called only after looking for a reusable file. Keep the original
// bytes and verify the source did not change between fingerprinting and writing.
func (u *PreparedUpload) Store(ownerID uint, purpose, visibility string) (StoredFile, error) {
	if _, err := u.src.Seek(0, io.SeekStart); err != nil {
		return StoredFile{}, err
	}
	objectKey := uuid.NewString()
	relativePath := buildRelativePath(ownerID, purpose, visibility, objectKey, u.Ext)
	absolutePath := AbsolutePath(relativePath)
	if err := os.MkdirAll(filepath.Dir(absolutePath), 0755); err != nil {
		return StoredFile{}, err
	}
	dst, err := os.OpenFile(absolutePath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err != nil {
		return StoredFile{}, err
	}
	hasher := sha256.New()
	size, copyErr := io.Copy(io.MultiWriter(dst, hasher), io.LimitReader(u.src, DefaultUploadMaxBytes+1))
	closeErr := dst.Close()
	if copyErr == nil {
		copyErr = closeErr
	}
	if copyErr == nil && (size != u.Size || hex.EncodeToString(hasher.Sum(nil)) != u.SHA256) {
		copyErr = fmt.Errorf("upload changed while being stored")
	}
	if copyErr != nil {
		if cleanupErr := os.Remove(absolutePath); cleanupErr != nil && !os.IsNotExist(cleanupErr) {
			return StoredFile{}, fmt.Errorf("%w; upload cleanup failed: %v", copyErr, cleanupErr)
		}
		return StoredFile{}, copyErr
	}
	return StoredFile{
		ObjectKey: objectKey, RelativePath: relativePath, AbsolutePath: absolutePath,
		PublicPath: PublicPath(relativePath), MimeType: u.MimeType, Ext: u.Ext,
		Size: u.Size, SHA256: u.SHA256,
	}, nil
}

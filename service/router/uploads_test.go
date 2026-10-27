package router

import (
	"bytes"
	"encoding/hex"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUploadThumbnailHTTP(t *testing.T) {
	t.Chdir(t.TempDir())
	if err := os.MkdirAll("data/uploads", 0755); err != nil {
		t.Fatal(err)
	}
	source := image.NewNRGBA(image.Rect(0, 0, 1000, 600))
	for y := range source.Bounds().Dy() {
		for x := range source.Bounds().Dx() {
			source.SetNRGBA(x, y, color.NRGBA{R: uint8((x*137 + y*31) % 256), G: uint8((x*43 + y*107) % 256), B: uint8((x*7 + y*79) % 256), A: 255})
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, source); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join("data", "uploads", "fixture.png")
	if err := os.WriteFile(file, encoded.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}
	engine := NewRouter()
	response := requestStatic(engine, http.MethodGet, "/uploads/fixture.png?thumbnail=1", map[string]string{"Accept-Encoding": "br, gzip"})
	if response.Code != 200 || !strings.HasPrefix(response.Header().Get("Content-Type"), "image/") || response.Header().Get("Content-Encoding") != "" || strings.Contains(response.Header().Get("Cache-Control"), "immutable") {
		t.Fatalf("thumbnail response status=%d headers=%v", response.Code, response.Header())
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(response.Body.Bytes()))
	if err != nil || config.Width > 320 || config.Height > 320 || config.Width == source.Bounds().Dx() {
		t.Fatalf("thumbnail config=%+v err=%v", config, err)
	}
	original := requestStatic(engine, http.MethodGet, "/uploads/fixture.png", nil)
	if original.Code != 200 || !bytes.Equal(original.Body.Bytes(), encoded.Bytes()) {
		t.Fatal("ordinary upload URL must retain the original file")
	}
	head := requestStatic(engine, http.MethodHead, "/uploads/fixture.png?thumbnail=1", nil)
	if head.Code != 200 || head.Body.Len() != 0 || head.Header().Get("Content-Length") != response.Header().Get("Content-Length") {
		t.Fatalf("thumbnail HEAD status=%d headers=%v", head.Code, head.Header())
	}
	if err := os.Remove(file); err != nil {
		t.Fatal(err)
	}
	missing := requestStatic(engine, http.MethodGet, "/uploads/fixture.png?thumbnail=1", nil)
	if missing.Code != http.StatusNotFound {
		t.Fatal("thumbnail cache must not expose a deleted source")
	}
}

func TestUploadThumbnailFallback(t *testing.T) {
	t.Chdir(t.TempDir())
	if err := os.MkdirAll("data/uploads", 0755); err != nil {
		t.Fatal(err)
	}
	source := []byte("an existing non-image upload")
	if err := os.WriteFile("data/uploads/fixture.gif", source, 0644); err != nil {
		t.Fatal(err)
	}
	engine := NewRouter()
	for _, query := range []string{"?thumbnail=1", "?thumbnail=0"} {
		response := requestStatic(engine, http.MethodGet, "/uploads/fixture.gif"+query, nil)
		if response.Code != 200 || !bytes.Equal(response.Body.Bytes(), source) {
			t.Fatalf("fallback %s: status=%d body=%q", query, response.Code, response.Body.String())
		}
	}
}

func TestUploadWebPThumbnailRequestsKeepOriginalBytes(t *testing.T) {
	t.Chdir(t.TempDir())
	if err := os.MkdirAll("data/uploads", 0755); err != nil {
		t.Fatal(err)
	}
	source, err := hex.DecodeString("5249464620000000574542505650384c130000002f8fc16300bcfef73f2200000000000000000000")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile("data/uploads/metadata.webp", source, 0644); err != nil {
		t.Fatal(err)
	}
	engine := NewRouter()
	for _, query := range []string{"", "?thumbnail=1", "?thumbnail=0"} {
		url := "/uploads/metadata.webp" + query
		response := requestStatic(engine, http.MethodGet, url, nil)
		if response.Code != 200 || !bytes.Equal(response.Body.Bytes(), source) || !strings.HasPrefix(response.Header().Get("Content-Type"), "image/webp") {
			t.Fatalf("WebP fallback %q: status=%d headers=%v", query, response.Code, response.Header())
		}
		head := requestStatic(engine, http.MethodHead, url, nil)
		if head.Code != 200 || head.Body.Len() != 0 || head.Header().Get("Content-Length") != response.Header().Get("Content-Length") {
			t.Fatalf("WebP HEAD %q: status=%d headers=%v", query, head.Code, head.Header())
		}
	}
	if entries, _ := os.ReadDir("data/runtime/cache/thumbnails"); len(entries) != 0 {
		t.Fatal("WebP HTTP request created a thumbnail cache")
	}
}

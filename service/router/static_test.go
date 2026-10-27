package router

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func staticFixture(t *testing.T) (*gin.Engine, []byte, []byte, []byte) {
	t.Helper()
	directory := t.TempDir()
	if err := os.MkdirAll(filepath.Join(directory, "assets"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(directory, "custom"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(directory, "static"), 0755); err != nil {
		t.Fatal(err)
	}
	source := []byte(strings.Repeat("const fixture = 'static delivery';\n", 100))
	var gz bytes.Buffer
	writer := gzip.NewWriter(&gz)
	if _, err := writer.Write(source); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	// The handler serves build-generated Brotli bytes without decoding them.
	br := []byte("fixture representing a precompressed Brotli file")
	for _, name := range []string{"index.html", "static/global.css", "sw.js", "registerSW.js", "manifest.webmanifest", "favicon.svg", "pwa-192x192.png", "assets/app-12345678.js", "assets/plain.js", "custom/custom.js"} {
		for suffix, data := range map[string][]byte{"": source, ".gz": gz.Bytes(), ".br": br} {
			filename := filepath.Join(directory, name+suffix)
			if err := os.WriteFile(filename, data, 0644); err != nil {
				t.Fatal(err)
			}
			modified := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
			if err := os.Chtimes(filename, modified, modified); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := os.WriteFile(filepath.Join(directory, "private.txt"), source, 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "static", "private.css"), source, 0644); err != nil {
		t.Fatal(err)
	}
	engine := gin.New()
	registerWebFiles(engine, directory)
	return engine, source, gz.Bytes(), br
}

func requestStatic(engine http.Handler, method, url string, headers map[string]string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, url, nil)
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	engine.ServeHTTP(recorder, request)
	return recorder
}

func TestStaticEncodingNegotiation(t *testing.T) {
	engine, source, gz, br := staticFixture(t)
	for _, tc := range []struct {
		accept, encoding string
		status           int
		body             []byte
	}{
		{"", "", 200, source},
		{"gzip", "gzip", 200, gz},
		{"gzip, br", "br", 200, br},
		{"br;q=0, gzip;q=1", "gzip", 200, gz},
		{"br;q=0.4, gzip;q=0.8, identity;q=0", "gzip", 200, gz},
		{"br;q=0.9, gzip;q=0.2, identity;q=0.1", "br", 200, br},
		{"br;q=0.8, identity;q=1", "", 200, source},
		{"*;q=1", "br", 200, br},
		{"*;q=1, br;q=0", "gzip", 200, gz},
		{"*;q=0, identity;q=1", "", 200, source},
		{"BR; Q=1, gzip;q=0", "br", 200, br},
		{"br;q=bogus, gzip;q=0", "", 200, source},
		{"br;q=1.1, gzip;q=0", "", 200, source},
		{"br;q=NaN, gzip;q=0", "", 200, source},
		{"br;q=0.1234, gzip;q=0", "", 200, source},
		{"br;q=1, br;q=0, gzip;q=0", "", 200, source},
		{"*;q=0", "", 406, nil},
		{"identity;q=0, zstd", "", 406, nil},
	} {
		t.Run(tc.accept, func(t *testing.T) {
			response := requestStatic(engine, http.MethodGet, "/assets/app-12345678.js", map[string]string{"Accept-Encoding": tc.accept})
			if response.Code != tc.status || response.Header().Get("Content-Encoding") != tc.encoding || !bytes.Equal(response.Body.Bytes(), tc.body) {
				t.Fatalf("status=%d encoding=%q body length=%d", response.Code, response.Header().Get("Content-Encoding"), response.Body.Len())
			}
			if response.Header().Get("Vary") != "Accept-Encoding" {
				t.Fatal("missing encoding cache variation")
			}
			if tc.status == 200 && !strings.Contains(response.Header().Get("Content-Type"), "javascript") {
				t.Fatalf("wrong MIME type: %s", response.Header().Get("Content-Type"))
			}
		})
	}
}

func TestStaticFallbackWithoutSidecars(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(filepath.Join(directory, "index.html"), []byte("older build"), 0644); err != nil {
		t.Fatal(err)
	}
	engine := gin.New()
	registerWebFiles(engine, directory)
	for _, tc := range []struct {
		accept string
		status int
	}{{"br, gzip", 200}, {"br, identity;q=0", 406}} {
		response := requestStatic(engine, http.MethodGet, "/", map[string]string{"Accept-Encoding": tc.accept})
		if response.Code != tc.status || response.Header().Get("Content-Encoding") != "" {
			t.Fatalf("accept %q: status=%d encoding=%q", tc.accept, response.Code, response.Header().Get("Content-Encoding"))
		}
	}
	if err := os.WriteFile(filepath.Join(directory, "index.html.br"), []byte("stale sidecar"), 0644); err != nil {
		t.Fatal(err)
	}
	stale := time.Now().Add(-time.Hour)
	if err := os.Chtimes(filepath.Join(directory, "index.html.br"), stale, stale); err != nil {
		t.Fatal(err)
	}
	response := requestStatic(engine, http.MethodGet, "/", map[string]string{"Accept-Encoding": "br"})
	if response.Code != 200 || response.Body.String() != "older build" || response.Header().Get("Content-Encoding") != "" {
		t.Fatal("stale sidecar must not hide a changed source file")
	}
}

func TestStaticCacheAndPublicBoundary(t *testing.T) {
	engine, _, _, _ := staticFixture(t)
	for _, url := range []string{"/", "/index.html", "/static/global.css", "/sw.js", "/registerSW.js", "/manifest.webmanifest", "/favicon.svg", "/assets/plain.js", "/custom/custom.js"} {
		response := requestStatic(engine, http.MethodGet, url, nil)
		if response.Code != 200 || response.Header().Get("Cache-Control") != "no-cache" {
			t.Fatalf("%s: status %d cache %q", url, response.Code, response.Header().Get("Cache-Control"))
		}
	}
	asset := requestStatic(engine, http.MethodGet, "/assets/app-12345678.js", nil)
	if asset.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Fatal("hashed assets must have immutable caching")
	}
	image := requestStatic(engine, http.MethodGet, "/pwa-192x192.png", map[string]string{"Accept-Encoding": "br, gzip"})
	if image.Code != 200 || image.Header().Get("Content-Encoding") != "" {
		t.Fatal("non-text static files must not use compression sidecars")
	}
	for _, url := range []string{"/private.txt", "/static/private.css", "/static/", "/static/../private.txt", "/static/global.css.gz", "/static/global.css.br", "/index.html.br", "/assets/../private.txt", "/assets/%2e%2e/private.txt", "/assets/app-12345678.js.gz", "/assets/app-12345678.js.br", "/assets/missing-12345678.js", "/assets/"} {
		response := requestStatic(engine, http.MethodGet, url, nil)
		if response.Code != 404 || strings.Contains(response.Header().Get("Cache-Control"), "immutable") {
			t.Fatalf("unexpected public/cache route %s: %d", url, response.Code)
		}
	}
}

func TestStaticPWAPrecacheDocuments(t *testing.T) {
	engine, source, gz, br := staticFixture(t)
	for _, url := range []string{"/index.html", "/static/global.css"} {
		for _, tc := range []struct {
			encoding string
			body     []byte
		}{{"identity", source}, {"gzip", gz}, {"br", br}} {
			t.Run(url+"/"+tc.encoding, func(t *testing.T) {
				headers := map[string]string{"Accept-Encoding": tc.encoding}
				response := requestStatic(engine, http.MethodGet, url, headers)
				if response.Code != 200 || !bytes.Equal(response.Body.Bytes(), tc.body) || response.Header().Get("Cache-Control") != "no-cache" {
					t.Fatalf("precache resource status=%d headers=%v", response.Code, response.Header())
				}
				head := requestStatic(engine, http.MethodHead, url, headers)
				if head.Code != 200 || head.Body.Len() != 0 || head.Header().Get("Content-Length") != strconv.Itoa(len(tc.body)) {
					t.Fatalf("precache HEAD status=%d headers=%v", head.Code, head.Header())
				}
				headers["If-Modified-Since"] = response.Header().Get("Last-Modified")
				cached := requestStatic(engine, http.MethodGet, url, headers)
				if cached.Code != 304 || cached.Body.Len() != 0 {
					t.Fatalf("precache revalidation status=%d", cached.Code)
				}
				delete(headers, "If-Modified-Since")
				headers["Range"] = "bytes=2-5"
				ranged := requestStatic(engine, http.MethodGet, url, headers)
				if ranged.Code != 206 || !bytes.Equal(ranged.Body.Bytes(), tc.body[2:6]) {
					t.Fatalf("precache range status=%d body=%q", ranged.Code, ranged.Body.String())
				}
			})
		}
	}
}

func TestStaticVaryAndMultipleEncodingHeaders(t *testing.T) {
	engine, _, _, br := staticFixture(t)
	// Use a separate route to ensure an existing Vary header survives negotiation.
	engine.GET("/vary", func(c *gin.Context) {
		c.Header("Vary", "Origin")
		addVary(c.Writer.Header(), "Accept-Encoding")
		addVary(c.Writer.Header(), "Accept-Encoding")
		c.Status(200)
	})
	response := requestStatic(engine, http.MethodGet, "/vary", nil)
	if strings.Join(response.Header().Values("Vary"), ", ") != "Origin, Accept-Encoding" {
		t.Fatal("Vary must preserve existing fields without duplicating encoding")
	}
	request := httptest.NewRequest(http.MethodGet, "/assets/app-12345678.js", nil)
	request.Header.Add("Accept-Encoding", "gzip;q=0.5")
	request.Header.Add("Accept-Encoding", "br, identity;q=0")
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	if recorder.Code != 200 || recorder.Header().Get("Content-Encoding") != "br" || !bytes.Equal(recorder.Body.Bytes(), br) {
		t.Fatalf("multiple encoding fields: status=%d headers=%v", recorder.Code, recorder.Header())
	}
}

func TestStaticHTTPFileSemantics(t *testing.T) {
	engine, source, gz, br := staticFixture(t)
	for _, tc := range []struct {
		accept string
		body   []byte
	}{{"identity", source}, {"gzip", gz}, {"br", br}} {
		t.Run(tc.accept, func(t *testing.T) {
			headers := map[string]string{"Accept-Encoding": tc.accept}
			get := requestStatic(engine, http.MethodGet, "/assets/app-12345678.js", headers)
			head := requestStatic(engine, http.MethodHead, "/assets/app-12345678.js", headers)
			if head.Code != 200 || head.Body.Len() != 0 || head.Header().Get("Content-Length") != strconv.Itoa(len(tc.body)) {
				t.Fatalf("HEAD status=%d length=%q body=%d", head.Code, head.Header().Get("Content-Length"), head.Body.Len())
			}
			modified := get.Header().Get("Last-Modified")
			if modified == "" || head.Header().Get("Last-Modified") != modified {
				t.Fatal("missing Last-Modified")
			}
			headers["If-Modified-Since"] = modified
			cached := requestStatic(engine, http.MethodGet, "/assets/app-12345678.js", headers)
			if cached.Code != 304 || cached.Body.Len() != 0 || cached.Header().Get("Content-Length") != "" {
				t.Fatalf("conditional status=%d headers=%v", cached.Code, cached.Header())
			}
			delete(headers, "If-Modified-Since")
			headers["Range"] = "bytes=2-5"
			ranged := requestStatic(engine, http.MethodGet, "/assets/app-12345678.js", headers)
			if ranged.Code != 206 || !bytes.Equal(ranged.Body.Bytes(), tc.body[2:6]) || ranged.Header().Get("Content-Range") != fmt.Sprintf("bytes 2-5/%d", len(tc.body)) {
				t.Fatalf("range status=%d headers=%v body=%q", ranged.Code, ranged.Header(), ranged.Body.String())
			}
			headers["If-Range"] = "Wed, 01 Jan 2020 00:00:00 GMT"
			full := requestStatic(engine, http.MethodGet, "/assets/app-12345678.js", headers)
			if full.Code != 200 || !bytes.Equal(full.Body.Bytes(), tc.body) {
				t.Fatalf("stale If-Range status=%d", full.Code)
			}
			delete(headers, "If-Range")
			headers["Range"] = "bytes=999999-"
			invalid := requestStatic(engine, http.MethodGet, "/assets/app-12345678.js", headers)
			if invalid.Code != 416 || invalid.Header().Get("Content-Encoding") != "" {
				t.Fatalf("invalid range status=%d headers=%v", invalid.Code, invalid.Header())
			}
		})
	}
}

func TestStaticPolicyDoesNotApplyToAPIOrUploads(t *testing.T) {
	t.Chdir(t.TempDir())
	if err := os.MkdirAll("data/uploads", 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile("data/uploads/app-12345678.js", []byte("uploaded"), 0644); err != nil {
		t.Fatal(err)
	}
	engine := NewRouter()
	for _, url := range []string{"/api/healthz", "/uploads/app-12345678.js"} {
		response := requestStatic(engine, http.MethodGet, url, map[string]string{"Accept-Encoding": "br, gzip"})
		if response.Code != 200 || response.Header().Get("Cache-Control") != "" || response.Header().Get("Content-Encoding") != "" {
			t.Fatalf("policy leaked to %s: status=%d headers=%v", url, response.Code, response.Header())
		}
	}
}

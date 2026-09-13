package router

import (
	"gopkg.in/ini.v1"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"zpanel/global"
	"zpanel/lib/iniConfig"

	"github.com/gin-gonic/gin"
)

func TestHealthz(t *testing.T) {
	t.Setenv("GIN_MODE", "test")

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/healthz", nil)

	NewRouter().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}

	if recorder.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("expected security headers on health response")
	}
}

func TestRouterDoesNotTrustForwardedForByDefault(t *testing.T) {
	t.Setenv("GIN_MODE", "test")

	router := NewRouter()
	router.GET("/client-ip-test", func(c *gin.Context) {
		c.String(http.StatusOK, c.ClientIP())
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/client-ip-test", nil)
	request.RemoteAddr = "203.0.113.10:12345"
	request.Header.Set("X-Forwarded-For", "198.51.100.77")

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if recorder.Body.String() != "203.0.113.10" {
		t.Fatalf("expected remote addr client IP, got %q", recorder.Body.String())
	}
}

func TestExplicitTrustedProxy(t *testing.T) {
	old := global.Config
	cfg, err := ini.Load([]byte("[base]\ntrusted_proxies=203.0.113.10\n"))
	if err != nil {
		t.Fatal(err)
	}
	global.Config = &iniConfig.IniConfig{Config: cfg}
	t.Cleanup(func() { global.Config = old })
	engine := NewRouter()
	engine.GET("/ip", func(c *gin.Context) { c.String(200, c.ClientIP()) })
	for _, tc := range []struct{ remote, want string }{{"203.0.113.10:1234", "198.51.100.77"}, {"203.0.113.11:1234", "203.0.113.11"}} {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/ip", nil)
		req.RemoteAddr = tc.remote
		req.Header.Set("X-Forwarded-For", "198.51.100.77")
		engine.ServeHTTP(recorder, req)
		if recorder.Body.String() != tc.want {
			t.Fatalf("got %s, want %s", recorder.Body.String(), tc.want)
		}
	}
}

func TestPublicPWAAssets(t *testing.T) {
	t.Chdir(t.TempDir())
	if err := os.Mkdir("web", 0755); err != nil {
		t.Fatal(err)
	}
	assets := []string{"manifest.webmanifest", "sw.js", "registerSW.js", "pwa-192x192.png", "pwa-512x512.png", "apple-touch-icon.png"}
	for _, name := range assets {
		if err := os.WriteFile(filepath.Join("web", name), []byte("fixture"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	engine := NewRouter()
	for _, name := range assets {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/"+name, nil))
		if recorder.Code != http.StatusOK || recorder.Body.String() != "fixture" {
			t.Fatalf("%s: status %d", name, recorder.Code)
		}
	}
	for _, name := range []string{"conf/conf.ini", "data/database/zpanel.db", "missing.js"} {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/"+name, nil))
		if recorder.Code != http.StatusNotFound {
			t.Fatalf("unexpected public path %s", name)
		}
	}
}

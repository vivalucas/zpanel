package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

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

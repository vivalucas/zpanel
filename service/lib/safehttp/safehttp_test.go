package safehttp

import (
	"context"
	"errors"
	"net"
	"net/http"
	"testing"
	"time"
)

func TestOnlyExactPrivateOriginUsesPrivateTransport(t *testing.T) {
	client := NewClientWithPrivateOrigins(time.Second, []string{"http://nas.example:8080"})
	policy := client.Transport.(*originTransport)
	var selected string
	for name, transport := range map[string]*http.Transport{"public": policy.public, "private": policy.private} {
		transport.DialContext = func(context.Context, string, string) (net.Conn, error) {
			selected = name
			return nil, errors.New("test dial stopped")
		}
	}
	for target, want := range map[string]string{
		"http://nas.example:8080/favicon.ico":   "private",
		"http://nas.example:8081/favicon.ico":   "public",
		"https://nas.example:8080/favicon.ico":  "public",
		"http://other.example:8080/favicon.ico": "public",
	} {
		selected = ""
		_, _ = client.Get(target)
		if selected != want {
			t.Fatalf("%s selected %s transport, want %s", target, selected, want)
		}
	}
}

func TestValidateURLRejectsUnsafeTargets(t *testing.T) {
	cases := []string{
		"http://localhost/favicon.ico",
		"http://127.0.0.1/favicon.ico",
		"http://10.0.0.1/favicon.ico",
		"http://172.16.0.1/favicon.ico",
		"http://192.168.1.1/favicon.ico",
		"http://169.254.169.254/latest/meta-data/",
		"file:///etc/passwd",
	}
	for _, rawURL := range cases {
		if err := ValidateURL(rawURL); err == nil {
			t.Fatalf("expected %s to be rejected", rawURL)
		}
	}
}

func TestPrivateOriginsNeverAllowOtherPortsOrMetadata(t *testing.T) {
	origins := []string{"http://192.168.1.10:8080", "http://127.0.0.1", "http://169.254.169.254", "http://100.100.100.200", "http://[fd00:ec2::254]"}
	if err := ValidateURLWithPrivateOrigins("http://192.168.1.10:8080/icon", origins); err != nil {
		t.Fatal(err)
	}
	for _, target := range []string{"http://192.168.1.10:8081/icon", "https://192.168.1.10:8080/icon", "http://192.168.1.11:8080", "http://127.0.0.1", "http://169.254.169.254", "http://100.100.100.200", "http://[fd00:ec2::254]", "http://user:pass@192.168.1.10:8080"} {
		if ValidateURLWithPrivateOrigins(target, origins) == nil {
			t.Fatalf("allowed %s", target)
		}
	}
	client := NewClientWithPrivateOrigins(time.Second, origins)
	redirect, _ := http.NewRequest("GET", "http://192.168.1.11:8080", nil)
	if client.CheckRedirect(redirect, []*http.Request{{}}) == nil {
		t.Fatal("redirect bypassed allowlist")
	}
}

func TestValidateURLAcceptsPublicHTTPURL(t *testing.T) {
	if err := ValidateURL("https://example.com/favicon.ico"); err != nil {
		t.Fatalf("expected public https url to pass, got %v", err)
	}
}

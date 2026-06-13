package safehttp

import "testing"

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

func TestValidateURLAcceptsPublicHTTPURL(t *testing.T) {
	if err := ValidateURL("https://example.com/favicon.ico"); err != nil {
		t.Fatalf("expected public https url to pass, got %v", err)
	}
}

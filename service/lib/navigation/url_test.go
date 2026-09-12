package navigation

import "testing"

func TestURLBoundaries(t *testing.T) {
	for _, raw := range []string{"https://example.com", "http://nas.local:8000", "/app", "//example.com", ""} {
		if err := Validate(raw); err != nil {
			t.Errorf("valid %q: %v", raw, err)
		}
	}
	for _, raw := range []string{"javascript:alert(1)", " javaScript:alert(1)", "java\nscript:alert(1)", "data:text/html,test", "file:///tmp/file", "\\\\example.com"} {
		if Validate(raw) == nil {
			t.Errorf("accepted %q", raw)
		}
	}
}

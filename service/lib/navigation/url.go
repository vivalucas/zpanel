package navigation

import (
	"fmt"
	"net/url"
	"strings"
)

// Validate allows web destinations and relative links, never executable URL schemes.
func Validate(raw string) error {
	if raw == "" {
		return nil
	}
	for _, r := range raw {
		if r < 32 || r == 127 || r == '\\' {
			return fmt.Errorf("invalid URL")
		}
	}
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return fmt.Errorf("invalid URL")
	}
	if u.Scheme != "" && u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("only HTTP(S) and relative URLs are allowed")
	}
	return nil
}

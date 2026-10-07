package safehttp

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var errUnsafeURL = errors.New("unsafe url")

func NewClient(timeout time.Duration) *http.Client {
	return NewClientWithPrivateOrigins(timeout, nil)
}

func transport(timeout time.Duration, private bool) *http.Transport {
	dialer := &net.Dialer{Timeout: timeout}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, err
		}
		for _, resolved := range ips {
			if isUnsafeIP(resolved.IP) && !(private && resolved.IP.IsPrivate() && !isForbiddenIP(resolved.IP)) {
				continue
			}
			return dialer.DialContext(ctx, network, net.JoinHostPort(resolved.IP.String(), port))
		}
		return nil, fmt.Errorf("%w: resolved host is not allowed", errUnsafeURL)
	}

	return transport
}

type originTransport struct {
	public, private *http.Transport
	origins         []string
}

func (t *originTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if err := ValidateURLWithPrivateOrigins(req.URL.String(), t.origins); err != nil {
		return nil, err
	}
	if allowedOrigin(req.URL, t.origins) {
		return t.private.RoundTrip(req)
	}
	return t.public.RoundTrip(req)
}

// Private access is confined to exact scheme/host/port entries; all other requests
// and redirects retain the public-only resolver. Loopback and metadata remain blocked.
func NewClientWithPrivateOrigins(timeout time.Duration, origins []string) *http.Client {
	return &http.Client{
		Timeout:   timeout,
		Transport: &originTransport{public: transport(timeout, false), private: transport(timeout, true), origins: origins},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects")
			}
			return ValidateURLWithPrivateOrigins(req.URL.String(), origins)
		},
	}
}

func ValidateURL(rawURL string) error {
	return ValidateURLWithPrivateOrigins(rawURL, nil)
}

func ValidateURLWithPrivateOrigins(rawURL string, origins []string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return err
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("%w: unsupported scheme", errUnsafeURL)
	}
	if parsed.User != nil {
		return fmt.Errorf("%w: credentials are not allowed", errUnsafeURL)
	}
	host := parsed.Hostname()
	if host == "" {
		return fmt.Errorf("%w: empty host", errUnsafeURL)
	}
	normalizedHost := strings.TrimSuffix(strings.ToLower(host), ".")
	if normalizedHost == "localhost" || strings.HasSuffix(normalizedHost, ".localhost") {
		return fmt.Errorf("%w: localhost is not allowed", errUnsafeURL)
	}
	if ip := net.ParseIP(normalizedHost); ip != nil && isUnsafeIP(ip) && !(ip.IsPrivate() && !isForbiddenIP(ip) && allowedOrigin(parsed, origins)) {
		return fmt.Errorf("%w: ip is not allowed", errUnsafeURL)
	}
	return nil
}

func allowedOrigin(target *url.URL, origins []string) bool {
	canonical := func(u *url.URL) string {
		port := u.Port()
		if port == "" {
			if u.Scheme == "https" {
				port = "443"
			} else {
				port = "80"
			}
		}
		return u.Scheme + "://" + net.JoinHostPort(strings.TrimSuffix(strings.ToLower(u.Hostname()), "."), port)
	}
	for _, raw := range origins {
		entry, err := url.Parse(strings.TrimSpace(raw))
		if err != nil || entry.User != nil || entry.RawQuery != "" || entry.Fragment != "" || (entry.Path != "" && entry.Path != "/") || entry.Hostname() == "" || (entry.Scheme != "http" && entry.Scheme != "https") {
			continue
		}
		if canonical(entry) == canonical(target) {
			return true
		}
	}
	return false
}

func isForbiddenIP(ip net.IP) bool {
	return ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() ||
		ip.Equal(net.ParseIP("100.100.100.200")) || ip.Equal(net.ParseIP("fd00:ec2::254"))
}

func isUnsafeIP(ip net.IP) bool {
	return isForbiddenIP(ip) ||
		ip.IsLoopback() ||
		ip.IsPrivate() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() ||
		ip.IsUnspecified() ||
		ip.IsMulticast()
}

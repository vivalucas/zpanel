package siteFavicon

import (
	"net/url"
	"testing"
)

func TestIconsRelativeToFinalPageAndKeepQuery(t *testing.T) {
	base, _ := url.Parse("https://example.com/app/index.html")
	icons, err := parseIcons(base, []byte(`<link rel="icon" href="icons/logo.png?size=32&amp;v=2"><link rel="icon" href="/favicon.ico">`))
	if err != nil {
		t.Fatal(err)
	}
	if len(icons) != 2 || icons[0] != "https://example.com/app/icons/logo.png?size=32&v=2" || icons[1] != "https://example.com/favicon.ico" {
		t.Fatalf("incorrect icons: %#v", icons)
	}
}

package router

import (
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

var hashedAssetName = regexp.MustCompile(`-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$`)
var compressibleWebName = regexp.MustCompile(`(?i)\.(?:css|html|js|json|svg|txt|webmanifest|xml)$`)

// registerWebFiles only exposes the public routes, never the whole web directory.
func registerWebFiles(router *gin.Engine, directory string) {
	files := http.Dir(directory)
	register := func(route string, filename func(*gin.Context) string, hashedAssets bool) {
		handler := func(c *gin.Context) {
			serveWebFile(c, files, filename(c), hashedAssets)
		}
		router.GET(route, handler)
		router.HEAD(route, handler)
	}
	register("/", func(*gin.Context) string { return "index.html" }, false)
	// Workbox requests the HTML document by its build filename when precaching.
	register("/index.html", func(*gin.Context) string { return "index.html" }, false)
	register("/static/global.css", func(*gin.Context) string { return "static/global.css" }, false)
	for _, prefix := range []string{"assets", "custom"} {
		register("/"+prefix+"/*filepath", func(c *gin.Context) string {
			return path.Join(prefix, path.Clean("/"+c.Param("filepath")))
		}, prefix == "assets")
	}
	for _, name := range []string{"favicon.ico", "favicon.svg", "manifest.webmanifest", "sw.js", "registerSW.js", "pwa-192x192.png", "pwa-512x512.png", "apple-touch-icon.png"} {
		register("/"+name, func(*gin.Context) string { return name }, false)
	}
}

func serveWebFile(c *gin.Context, files http.FileSystem, name string, hashedAssets bool) {
	// Compression variants are implementation files, not additional public URLs.
	lowerName := strings.ToLower(name)
	if strings.HasSuffix(lowerName, ".gz") || strings.HasSuffix(lowerName, ".br") {
		c.Status(http.StatusNotFound)
		return
	}
	original, err := files.Open(name)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer original.Close()
	info, err := original.Stat()
	if err != nil || !info.Mode().IsRegular() {
		c.Status(http.StatusNotFound)
		return
	}

	addVary(c.Writer.Header(), "Accept-Encoding")
	qualities := acceptedEncodings(c.Request.Header.Values("Accept-Encoding"))
	selected := original
	encoding := ""
	quality := qualities["identity"]
	compressible := compressibleWebName.MatchString(name)
	// Prefer Brotli, then gzip, on equal quality; identity stays available for old builds.
	for _, candidate := range []struct{ coding, extension string }{{"br", ".br"}, {"gzip", ".gz"}} {
		q := qualities[candidate.coding]
		if !compressible || q <= 0 || q < quality || (q == quality && encoding != "") {
			continue
		}
		variant, openErr := files.Open(name + candidate.extension)
		if openErr != nil {
			continue
		}
		variantInfo, statErr := variant.Stat()
		if statErr != nil || !variantInfo.Mode().IsRegular() || variantInfo.ModTime().Before(info.ModTime()) {
			variant.Close()
			continue
		}
		if selected != original {
			selected.Close()
		}
		selected, encoding, quality = variant, candidate.coding, q
	}
	if selected != original {
		defer selected.Close()
	}
	if quality <= 0 {
		c.Header("Cache-Control", "no-store")
		c.Status(http.StatusNotAcceptable)
		return
	}

	if hashedAssets && hashedAssetName.MatchString(path.Base(name)) {
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		// HTML, service workers and unhashed public files must revalidate after a release.
		c.Header("Cache-Control", "no-cache")
	}
	if encoding != "" {
		c.Header("Content-Encoding", encoding)
		selectedInfo, statErr := selected.Stat()
		if statErr != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Header("Content-Length", strconv.FormatInt(selectedInfo.Size(), 10))
	}
	// Use the original name/type and mtime with a seekable selected representation.
	// ServeContent retains HEAD, conditional requests and byte ranges without runtime compression.
	http.ServeContent(c.Writer, c.Request, name, info.ModTime(), selected)
}

func addVary(header http.Header, name string) {
	for _, value := range header.Values("Vary") {
		for _, item := range strings.Split(value, ",") {
			if strings.EqualFold(strings.TrimSpace(item), name) || strings.TrimSpace(item) == "*" {
				return
			}
		}
	}
	header.Add("Vary", name)
}

func acceptedEncodings(headers []string) map[string]float64 {
	weights := map[string]float64{}
	for _, value := range headers {
		for _, item := range strings.Split(value, ",") {
			parts := strings.Split(item, ";")
			coding := strings.ToLower(strings.TrimSpace(parts[0]))
			if coding == "" {
				continue
			}
			quality := float64(1)
			for i, parameter := range parts[1:] {
				key, raw, found := strings.Cut(parameter, "=")
				var valid bool
				if found && strings.EqualFold(strings.TrimSpace(key), "q") && i == 0 {
					quality, valid = encodingQuality(strings.TrimSpace(raw))
				}
				if !valid {
					quality = 0
					break
				}
			}
			// Conflicting duplicate weights conservatively honor an explicit exclusion.
			if old, exists := weights[coding]; !exists || quality < old {
				weights[coding] = quality
			}
		}
	}
	result := map[string]float64{"identity": 1}
	for _, coding := range []string{"br", "gzip"} {
		result[coding] = weights["*"]
		if quality, exists := weights[coding]; exists {
			result[coding] = quality
		}
	}
	if quality, exists := weights["identity"]; exists {
		result["identity"] = quality
	} else if quality, exists := weights["*"]; exists && quality == 0 {
		result["identity"] = 0
	}
	return result
}

func encodingQuality(raw string) (float64, bool) {
	whole, fraction, _ := strings.Cut(raw, ".")
	if (whole != "0" && whole != "1") || len(fraction) > 3 {
		return 0, false
	}
	for _, digit := range fraction {
		if digit < '0' || digit > '9' || (whole == "1" && digit != '0') {
			return 0, false
		}
	}
	quality, err := strconv.ParseFloat(raw, 64)
	return quality, err == nil
}

package storage

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/image/draw"
)

const (
	ThumbnailMaxDimension = 320
	thumbnailMaxPixels    = 16 * 1024 * 1024
	thumbnailMaxSide      = 16 * 1024
)

var (
	// A single decoder bounds peak memory when a gallery requests many large images.
	thumbnailMu    sync.Mutex
	errNoThumbnail = errors.New("thumbnail unavailable; use the original image")
)

// SupportsThumbnail only enables bounded PNG/JPEG decoding. WebP stays on its
// original URL because the current decoder can allocate large metadata tables
// independently of the image dimensions.
func SupportsThumbnail(relativePath string) bool {
	switch strings.ToLower(filepath.Ext(relativePath)) {
	case ".png", ".jpg", ".jpeg":
		return true
	default:
		return false
	}
}

func thumbnailRelativePath(relativePath string) (string, error) {
	if relativePath == "" || strings.ContainsAny(relativePath, "\\\x00") || filepath.IsAbs(relativePath) {
		return "", errNoThumbnail
	}
	for _, part := range strings.Split(relativePath, "/") {
		if part == ".." {
			return "", errNoThumbnail
		}
	}
	clean := filepath.Clean(filepath.FromSlash(relativePath))
	if clean == "." || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", errNoThumbnail
	}
	return clean, nil
}

func thumbnailPathKey(relativePath string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(filepath.ToSlash(relativePath))))
}

func openThumbnailSource(relativePath string) (*os.File, os.FileInfo, error) {
	root, err := os.OpenRoot(UploadsPath())
	if err != nil {
		return nil, nil, err
	}
	defer root.Close()
	file, err := root.Open(relativePath)
	if err != nil {
		return nil, nil, err
	}
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Size() <= 0 || info.Size() > DefaultUploadMaxBytes {
		file.Close()
		return nil, nil, errNoThumbnail
	}
	return file, info, nil
}

func thumbnailCacheBase(relativePath string, info os.FileInfo) string {
	// Include source metadata and an algorithm version so replacements invalidate
	// derived files without changing the original URL or the database schema.
	fingerprint := fmt.Sprintf("v2:%d:%d", info.Size(), info.ModTime().UnixNano())
	return filepath.Join(CachePath(), "thumbnails", thumbnailPathKey(relativePath)+"-"+fmt.Sprintf("%x", sha256.Sum256([]byte(fingerprint))))
}

func existingThumbnail(base string) string {
	for _, ext := range []string{".jpg", ".png"} {
		if info, err := os.Stat(base + ext); err == nil && info.Mode().IsRegular() && info.Size() > 0 {
			return base + ext
		}
	}
	return ""
}

// Thumbnail lazily builds a bounded gallery image in the regenerable cache.
// Callers must fall back to the existing upload handler on error. The original
// is opened before checking the cache, so deleted files cannot survive via it.
func Thumbnail(relativePath string) (string, error) {
	relativePath, err := thumbnailRelativePath(relativePath)
	if err != nil || !SupportsThumbnail(relativePath) {
		return "", errNoThumbnail
	}
	file, info, err := openThumbnailSource(relativePath)
	if err != nil {
		return "", err
	}
	base := thumbnailCacheBase(relativePath, info)
	file.Close()
	if cached := existingThumbnail(base); cached != "" {
		return cached, nil
	}

	thumbnailMu.Lock()
	defer thumbnailMu.Unlock()
	// A queued request may refer to a file deleted or replaced while waiting.
	file, info, err = openThumbnailSource(relativePath)
	if err != nil {
		return "", err
	}
	defer file.Close()
	base = thumbnailCacheBase(relativePath, info)
	if cached := existingThumbnail(base); cached != "" {
		return cached, nil
	}
	// Decode the same bounded bytes inspected by DecodeConfig, even if an external
	// process rewrites the upload while the request is running.
	data, err := io.ReadAll(io.LimitReader(file, DefaultUploadMaxBytes+1))
	if err != nil || len(data) > DefaultUploadMaxBytes {
		return "", errNoThumbnail
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "png" && format != "jpeg") || config.Width <= 0 || config.Height <= 0 ||
		config.Width > thumbnailMaxSide || config.Height > thumbnailMaxSide || uint64(config.Width)*uint64(config.Height) > thumbnailMaxPixels ||
		(config.Width <= ThumbnailMaxDimension && config.Height <= ThumbnailMaxDimension) || (format == "jpeg" && jpegNeedsOrientation(data)) ||
		(format == "png" && pngIsAnimated(data)) {
		return "", errNoThumbnail
	}
	source, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	width, height := ThumbnailMaxDimension, ThumbnailMaxDimension
	if config.Width >= config.Height {
		height = max(1, config.Height*ThumbnailMaxDimension/config.Width)
	} else {
		width = max(1, config.Width*ThumbnailMaxDimension/config.Height)
	}
	thumbnail := image.NewNRGBA(image.Rect(0, 0, width, height))
	draw.ApproxBiLinear.Scale(thumbnail, thumbnail.Bounds(), source, source.Bounds(), draw.Src, nil)
	ext := ".png"
	if thumbnail.Opaque() {
		ext = ".jpg"
	}
	if err := os.MkdirAll(filepath.Dir(base), 0755); err != nil {
		return "", err
	}
	temp, err := os.CreateTemp(filepath.Dir(base), ".thumbnail-*")
	if err != nil {
		return "", err
	}
	defer os.Remove(temp.Name())
	if ext == ".jpg" {
		err = jpeg.Encode(temp, thumbnail, &jpeg.Options{Quality: 82})
	} else {
		err = png.Encode(temp, thumbnail)
	}
	closeErr := temp.Close()
	if err != nil {
		return "", err
	}
	if closeErr != nil {
		return "", closeErr
	}
	if cachedInfo, err := os.Stat(temp.Name()); err != nil || cachedInfo.Size() >= info.Size() {
		return "", errNoThumbnail
	}
	if err := os.Rename(temp.Name(), base+ext); err != nil {
		return "", err
	}
	return base + ext, nil
}

// image/png decodes an APNG's first frame without reporting the animation.
// Inspect actual bounded chunks so a text or compressed-data substring cannot
// turn an ordinary PNG into a false animation match.
func pngIsAnimated(data []byte) bool {
	if len(data) < 8 || !bytes.Equal(data[:8], []byte("\x89PNG\r\n\x1a\n")) {
		return false
	}
	for offset := 8; len(data)-offset >= 12; {
		end := uint64(offset) + 12 + uint64(binary.BigEndian.Uint32(data[offset:]))
		if end > uint64(len(data)) {
			return false
		}
		switch string(data[offset+4 : offset+8]) {
		case "acTL":
			return true
		case "IEND":
			return false
		}
		offset = int(end)
	}
	return false
}

// The standard JPEG decoder does not apply EXIF orientation. Keep the original
// for rotated/mirrored or malformed EXIF rather than returning a wrong preview.
func jpegNeedsOrientation(data []byte) bool {
	if len(data) < 2 || data[0] != 0xff || data[1] != 0xd8 {
		return false
	}
	for offset := 2; offset+4 <= len(data); {
		if data[offset] != 0xff {
			return false
		}
		marker := data[offset+1]
		if marker == 0xff {
			offset++
			continue
		}
		if marker == 0xda || marker == 0xd9 {
			return false
		}
		length := int(binary.BigEndian.Uint16(data[offset+2:]))
		if length < 2 || offset+2+length > len(data) {
			return false
		}
		payload := data[offset+4 : offset+2+length]
		if marker == 0xe1 && bytes.HasPrefix(payload, []byte("Exif\x00\x00")) {
			tiff := payload[6:]
			if len(tiff) < 8 {
				return true
			}
			var order binary.ByteOrder
			switch string(tiff[:2]) {
			case "II":
				order = binary.LittleEndian
			case "MM":
				order = binary.BigEndian
			default:
				return true
			}
			if order.Uint16(tiff[2:]) != 42 {
				return true
			}
			ifd := uint64(order.Uint32(tiff[4:]))
			if ifd+2 > uint64(len(tiff)) {
				return true
			}
			count := uint64(order.Uint16(tiff[ifd:]))
			if ifd+2+12*count > uint64(len(tiff)) {
				return true
			}
			for entry := ifd + 2; entry < ifd+2+12*count; entry += 12 {
				if order.Uint16(tiff[entry:]) == 0x0112 {
					if order.Uint16(tiff[entry+2:]) != 3 || order.Uint32(tiff[entry+4:]) != 1 || order.Uint16(tiff[entry+8:]) != 1 {
						return true
					}
				}
			}
		}
		offset += 2 + length
	}
	return false
}

// RemoveThumbnails cleans regenerable derivatives when a file is deleted.
func RemoveThumbnails(relativePath string) {
	clean, err := thumbnailRelativePath(relativePath)
	if err != nil {
		return
	}
	thumbnailMu.Lock()
	defer thumbnailMu.Unlock()
	paths, _ := filepath.Glob(filepath.Join(CachePath(), "thumbnails", thumbnailPathKey(clean)+"-*"))
	for _, path := range paths {
		_ = os.Remove(path)
	}
}

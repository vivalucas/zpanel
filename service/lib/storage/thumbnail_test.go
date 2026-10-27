package storage

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"math/rand"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"
	"zpanel/global"
	"zpanel/lib/iniConfig"

	"golang.org/x/image/webp"
	"gopkg.in/ini.v1"
)

func thumbnailTestStorage(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	config := ini.Empty()
	config.Section("storage").Key("uploads_path").SetValue(filepath.Join(root, "uploads"))
	config.Section("storage").Key("cache_path").SetValue(filepath.Join(root, "cache"))
	oldConfig := global.Config
	global.Config = &iniConfig.IniConfig{Config: config}
	t.Cleanup(func() { global.Config = oldConfig })
	if err := os.MkdirAll(UploadsPath(), 0755); err != nil {
		t.Fatal(err)
	}
	return root
}

func writeThumbnailSource(t *testing.T, relativePath string, transparent bool, seed int64) []byte {
	t.Helper()
	source := image.NewNRGBA(image.Rect(0, 0, 960, 540))
	random := rand.New(rand.NewSource(seed))
	for y := 0; y < 540; y++ {
		for x := 0; x < 960; x++ {
			alpha := uint8(255)
			if transparent && x < 480 {
				alpha = 100
			}
			source.SetNRGBA(x, y, color.NRGBA{R: uint8(random.Intn(256)), G: uint8(random.Intn(256)), B: uint8(random.Intn(256)), A: alpha})
		}
	}
	var data bytes.Buffer
	if err := png.Encode(&data, source); err != nil {
		t.Fatal(err)
	}
	absolutePath := AbsolutePath(relativePath)
	if err := os.MkdirAll(filepath.Dir(absolutePath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(absolutePath, data.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}
	return data.Bytes()
}

func TestThumbnailPreservesOriginalAndReusesBoundedCache(t *testing.T) {
	thumbnailTestStorage(t)
	for _, transparent := range []bool{false, true} {
		name := "public/gallery/opaque.png"
		wantFormat := "jpeg"
		if transparent {
			name, wantFormat = "public/gallery/transparent.png", "png"
		}
		original := writeThumbnailSource(t, name, transparent, 7)
		cached, err := Thumbnail(name)
		if err != nil {
			t.Fatal(err)
		}
		data, err := os.ReadFile(cached)
		if err != nil {
			t.Fatal(err)
		}
		config, format, err := image.DecodeConfig(bytes.NewReader(data))
		if err != nil || config.Width != 320 || config.Height != 180 || format != wantFormat {
			t.Fatalf("unexpected thumbnail: config=%+v format=%q err=%v", config, format, err)
		}
		if len(data) >= len(original) {
			t.Fatalf("thumbnail did not reduce bytes: original=%d derivative=%d", len(original), len(data))
		}
		if after, err := os.ReadFile(AbsolutePath(name)); err != nil || !bytes.Equal(after, original) {
			t.Fatal("thumbnail generation modified the original")
		}
		oldTime := time.Now().Add(-2 * time.Hour).Truncate(time.Second)
		if err := os.Chtimes(cached, oldTime, oldTime); err != nil {
			t.Fatal(err)
		}
		second, err := Thumbnail(name)
		info, statErr := os.Stat(second)
		if err != nil || statErr != nil || second != cached || !info.ModTime().Equal(oldTime) {
			t.Fatalf("cached thumbnail was regenerated: %s %v %v", second, err, statErr)
		}
		if transparent {
			decoded, _, err := image.Decode(bytes.NewReader(data))
			if err != nil {
				t.Fatal(err)
			}
			_, _, _, alpha := decoded.At(10, 10).RGBA()
			if alpha == 0xffff {
				t.Fatal("thumbnail discarded transparency")
			}
		}
	}
}

func TestThumbnailSourceChangesAndDeletionInvalidateCache(t *testing.T) {
	thumbnailTestStorage(t)
	name := "public/gallery/source.png"
	writeThumbnailSource(t, name, false, 1)
	first, err := Thumbnail(name)
	if err != nil {
		t.Fatal(err)
	}
	writeThumbnailSource(t, name, false, 2)
	future := time.Now().Add(time.Minute)
	if err := os.Chtimes(AbsolutePath(name), future, future); err != nil {
		t.Fatal(err)
	}
	second, err := Thumbnail(name)
	if err != nil || first == second {
		t.Fatalf("replacement reused old cache: %s %s %v", first, second, err)
	}
	if err := os.Remove(AbsolutePath(name)); err != nil {
		t.Fatal(err)
	}
	if cached, err := Thumbnail(name); err == nil || cached != "" {
		t.Fatal("deleted source remained available via thumbnail cache")
	}
	RemoveThumbnails(name)
	for _, cached := range []string{first, second} {
		if _, err := os.Stat(cached); !os.IsNotExist(err) {
			t.Fatalf("delete left derivative %s: %v", cached, err)
		}
	}
}

func TestThumbnailRejectsEscapesUnsupportedFilesAndResourceLimits(t *testing.T) {
	root := thumbnailTestStorage(t)
	outside := filepath.Join(root, "outside.png")
	if err := os.WriteFile(outside, []byte("outside"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(UploadsPath(), "escape.png")); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"../outside.png", "/outside.png", "a/../../outside.png", "a\\outside.png", "bad\x00.png", "escape.png", "animation.gif", "vector.svg", "icon.ico", "."} {
		if cached, err := Thumbnail(name); err == nil || cached != "" {
			t.Fatalf("unsafe or unsupported path %q produced thumbnail %q", name, cached)
		}
	}
	for _, dimensions := range [][2]uint32{{5000, 5000}, {thumbnailMaxSide + 1, 1}} {
		var header bytes.Buffer
		header.WriteString("\x89PNG\r\n\x1a\n")
		binary.Write(&header, binary.BigEndian, uint32(13))
		chunk := make([]byte, 17)
		copy(chunk, "IHDR")
		binary.BigEndian.PutUint32(chunk[4:], dimensions[0])
		binary.BigEndian.PutUint32(chunk[8:], dimensions[1])
		chunk[12], chunk[13] = 8, 6
		header.Write(chunk)
		binary.Write(&header, binary.BigEndian, crc32.ChecksumIEEE(chunk))
		if _, _, err := image.DecodeConfig(bytes.NewReader(header.Bytes())); err != nil {
			t.Fatalf("invalid dimension fixture: %v", err)
		}
		if err := os.WriteFile(AbsolutePath("oversized.png"), header.Bytes(), 0644); err != nil {
			t.Fatal(err)
		}
		if _, err := Thumbnail("oversized.png"); err == nil {
			t.Fatal("oversized decoded image was accepted")
		}
	}
	if err := os.WriteFile(AbsolutePath("large.png"), []byte("image"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Truncate(AbsolutePath("large.png"), DefaultUploadMaxBytes+1); err != nil {
		t.Fatal(err)
	}
	if _, err := Thumbnail("large.png"); err == nil {
		t.Fatal("oversized file was accepted")
	}
	RemoveThumbnails("../outside.png")
	if data, err := os.ReadFile(outside); err != nil || string(data) != "outside" {
		t.Fatal("thumbnail cleanup escaped its cache")
	}
	if entries, _ := os.ReadDir(filepath.Join(CachePath(), "thumbnails")); len(entries) != 0 {
		t.Fatal("rejected sources created cache files")
	}
}

func TestThumbnailConcurrentRequestsShareOneDerivative(t *testing.T) {
	thumbnailTestStorage(t)
	name := "source.png"
	writeThumbnailSource(t, name, false, 42)
	var wait sync.WaitGroup
	for range 8 {
		wait.Go(func() {
			if _, err := Thumbnail(name); err != nil {
				t.Errorf("concurrent generation failed: %v", err)
			}
		})
	}
	wait.Wait()
	entries, err := os.ReadDir(filepath.Join(CachePath(), "thumbnails"))
	if err != nil || len(entries) != 1 || entries[0].Name()[0] == '.' {
		t.Fatalf("concurrent requests left extra or partial files: %v %v", entries, err)
	}
}

func TestThumbnailPreservesJPEGWithEXIFOrientation(t *testing.T) {
	thumbnailTestStorage(t)
	data := writeThumbnailSource(t, "source.png", false, 9)
	source, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	var jpegData bytes.Buffer
	if err := jpeg.Encode(&jpegData, source, &jpeg.Options{Quality: 85}); err != nil {
		t.Fatal(err)
	}
	for _, orientation := range []byte{1, 2, 6, 8} {
		exif := []byte("Exif\x00\x00II\x2a\x00\x08\x00\x00\x00\x01\x00\x12\x01\x03\x00\x01\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00")
		exif[24] = orientation
		var withEXIF bytes.Buffer
		withEXIF.Write(jpegData.Bytes()[:2])
		withEXIF.Write([]byte{0xff, 0xe1})
		binary.Write(&withEXIF, binary.BigEndian, uint16(len(exif)+2))
		withEXIF.Write(exif)
		withEXIF.Write(jpegData.Bytes()[2:])
		if err := os.WriteFile(AbsolutePath("photo.jpg"), withEXIF.Bytes(), 0644); err != nil {
			t.Fatal(err)
		}
		_, err := Thumbnail("photo.jpg")
		if orientation == 1 && err != nil {
			t.Fatalf("ordinary EXIF image did not receive a thumbnail: %v", err)
		}
		if orientation != 1 && err == nil {
			t.Fatalf("JPEG orientation %d was lost in thumbnail", orientation)
		}
	}
}

func appendPNGChunk(target *bytes.Buffer, kind string, payload []byte) {
	binary.Write(target, binary.BigEndian, uint32(len(payload)))
	chunk := append([]byte(kind), payload...)
	target.Write(chunk)
	binary.Write(target, binary.BigEndian, crc32.ChecksumIEEE(chunk))
}

func TestThumbnailPreservesAPNGAnimation(t *testing.T) {
	thumbnailTestStorage(t)
	first := writeThumbnailSource(t, "first.png", false, 71)
	second := writeThumbnailSource(t, "second.png", false, 72)
	var animation bytes.Buffer
	animation.Write(first[:8])
	appendPNGChunk(&animation, "IHDR", first[16:29])
	control := make([]byte, 8)
	binary.BigEndian.PutUint32(control, 2) // Two frames, played indefinitely.
	appendPNGChunk(&animation, "acTL", control)
	var sequence uint32
	for frame, encoded := range [][]byte{first, second} {
		frameControl := make([]byte, 26)
		binary.BigEndian.PutUint32(frameControl, sequence)
		sequence++
		binary.BigEndian.PutUint32(frameControl[4:], 960)
		binary.BigEndian.PutUint32(frameControl[8:], 540)
		binary.BigEndian.PutUint16(frameControl[20:], 1)
		binary.BigEndian.PutUint16(frameControl[22:], 10)
		appendPNGChunk(&animation, "fcTL", frameControl)
		for offset := 8; offset+12 <= len(encoded); {
			length := int(binary.BigEndian.Uint32(encoded[offset:]))
			if string(encoded[offset+4:offset+8]) == "IDAT" {
				payload := encoded[offset+8 : offset+8+length]
				if frame == 0 {
					appendPNGChunk(&animation, "IDAT", payload)
				} else {
					frameData := make([]byte, 4+len(payload))
					binary.BigEndian.PutUint32(frameData, sequence)
					sequence++
					copy(frameData[4:], payload)
					appendPNGChunk(&animation, "fdAT", frameData)
				}
			}
			offset += 12 + length
		}
	}
	appendPNGChunk(&animation, "IEND", nil)
	if decoded, err := png.Decode(bytes.NewReader(animation.Bytes())); err != nil || decoded.Bounds() != image.Rect(0, 0, 960, 540) {
		t.Fatalf("APNG fixture must decode its first frame: %v", err)
	}
	if err := os.WriteFile(AbsolutePath("animation.png"), animation.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}
	if cached, err := Thumbnail("animation.png"); err == nil || cached != "" {
		t.Fatal("APNG animation was replaced by a static first-frame thumbnail")
	}
	if entries, _ := os.ReadDir(filepath.Join(CachePath(), "thumbnails")); len(entries) != 0 {
		t.Fatal("APNG created a static thumbnail cache")
	}

	var ordinary bytes.Buffer
	ordinary.Write(first[:33]) // Signature and IHDR.
	appendPNGChunk(&ordinary, "tEXt", []byte("description\x00acTL is only text here"))
	ordinary.Write(first[33:])
	if err := os.WriteFile(AbsolutePath("ordinary.png"), ordinary.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := Thumbnail("ordinary.png"); err != nil {
		t.Fatalf("ordinary PNG text was mistaken for animation: %v", err)
	}
}

func TestPNGAnimationDetectionBoundsChunkLengths(t *testing.T) {
	for _, data := range [][]byte{
		[]byte("not a PNG: acTL"),
		[]byte("\x89PNG\r\n\x1a\n\xff\xff\xff\xffacTL\x00\x00\x00\x00"),
		[]byte("\x89PNG\r\n\x1a\n\x00\x00\x00\x00abc"),
	} {
		if pngIsAnimated(data) {
			t.Fatal("truncated or overflowing chunk was accepted as animation")
		}
	}
}

func TestThumbnailRejectsWebPMetadataBeforeRasterDecoding(t *testing.T) {
	thumbnailTestStorage(t)
	// A 400x400 VP8L header passes the old dimension limit. Its one-pixel
	// meta image selects Huffman group 65535, which makes the current decoder
	// allocate about 168 MiB before rejecting the remaining invalid tree data.
	data, err := hex.DecodeString("5249464620000000574542505650384c130000002f8fc16300bcfef73f2200000000000000000000")
	if err != nil {
		t.Fatal(err)
	}
	config, err := webp.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width != 400 || config.Height != 400 {
		t.Fatalf("expected bounded WebP header: config=%+v err=%v", config, err)
	}
	// Importing webp in this test registers its decoder. Even if another future
	// production import registers it too, a disguised extension must stay safe.
	for _, name := range []string{"metadata.webp", "metadata.WEBP", "disguised.png", "disguised.jpg", "disguised.jpeg"} {
		t.Run(name, func(t *testing.T) {
			if err := os.WriteFile(AbsolutePath(name), data, 0644); err != nil {
				t.Fatal(err)
			}
			var before, after runtime.MemStats
			runtime.ReadMemStats(&before)
			cached, thumbnailErr := Thumbnail(name)
			runtime.ReadMemStats(&after)
			if allocated := after.TotalAlloc - before.TotalAlloc; allocated > 8*1024*1024 {
				t.Fatalf("WebP metadata reached expensive decoding: allocated %d bytes", allocated)
			}
			if thumbnailErr == nil || cached != "" {
				t.Fatalf("WebP produced a thumbnail: %q %v", cached, thumbnailErr)
			}
			if original, err := os.ReadFile(AbsolutePath(name)); err != nil || !bytes.Equal(original, data) {
				t.Fatalf("WebP original changed: %v", err)
			}
		})
	}
	if entries, _ := os.ReadDir(filepath.Join(CachePath(), "thumbnails")); len(entries) != 0 {
		t.Fatal("rejected WebP created a thumbnail cache")
	}
}

func TestThumbnailDoesNotServePreviouslyCachedWebPDerivative(t *testing.T) {
	thumbnailTestStorage(t)
	name := "source.webp"
	if err := os.WriteFile(AbsolutePath(name), []byte("original WebP bytes"), 0644); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(AbsolutePath(name))
	if err != nil {
		t.Fatal(err)
	}
	base := thumbnailCacheBase(name, info)
	if err := os.MkdirAll(filepath.Dir(base), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(base+".jpg", []byte("old cached derivative"), 0644); err != nil {
		t.Fatal(err)
	}
	if cached, err := Thumbnail(name); err == nil || cached != "" {
		t.Fatalf("WebP reused an old derivative instead of the original: %q %v", cached, err)
	}
	RemoveThumbnails(name)
	if _, err := os.Stat(base + ".jpg"); !os.IsNotExist(err) {
		t.Fatalf("WebP derivative cleanup failed: %v", err)
	}
}

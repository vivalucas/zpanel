package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"zpanel/global"

	"github.com/google/uuid"
)

const (
	VisibilityPrivate = "private"
	VisibilityPublic  = "public"
	VisibilitySystem  = "system"

	PurposeIcon       = "icon"
	PurposeWallpaper  = "wallpaper"
	PurposeAvatar     = "avatar"
	PurposeSiteIcon   = "site_icon"
	PurposeAttachment = "attachment"
	PurposeBackup     = "backup"
)

type StoredFile struct {
	ObjectKey    string
	RelativePath string
	AbsolutePath string
	PublicPath   string
	MimeType     string
	Ext          string
	Size         int64
	SHA256       string
}

func DataPath() string {
	return configValue("storage", "data_path", "./data")
}

func UploadsPath() string {
	return configValue("storage", "uploads_path", filepath.Join(DataPath(), "uploads"))
}

func TempPath() string {
	return configValue("storage", "temp_path", filepath.Join(DataPath(), "runtime", "temp"))
}

func CachePath() string {
	return configValue("storage", "cache_path", filepath.Join(DataPath(), "runtime", "cache"))
}

func LogsPath() string {
	return configValue("storage", "logs_path", filepath.Join(DataPath(), "runtime", "logs"))
}

func BackupsPath() string {
	return configValue("storage", "backups_path", filepath.Join(DataPath(), "backups"))
}

func EnsureRuntimeDirs() error {
	dirs := []string{
		filepath.Join(DataPath(), "database"),
		UploadsPath(),
		TempPath(),
		CachePath(),
		LogsPath(),
		BackupsPath(),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

func StoreUpload(file *multipart.FileHeader, ownerID uint, purpose, visibility string, allowedExts []string) (StoredFile, error) {
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		return StoredFile{}, fmt.Errorf("missing file extension")
	}
	if len(allowedExts) > 0 && !contains(allowedExts, ext) {
		return StoredFile{}, fmt.Errorf("unsupported file extension: %s", ext)
	}

	src, err := file.Open()
	if err != nil {
		return StoredFile{}, err
	}
	defer src.Close()

	objectKey := uuid.NewString()
	relativePath := buildRelativePath(ownerID, purpose, visibility, objectKey, ext)
	absolutePath := filepath.Join(UploadsPath(), filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(absolutePath), 0755); err != nil {
		return StoredFile{}, err
	}

	dst, err := os.OpenFile(absolutePath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err != nil {
		return StoredFile{}, err
	}
	defer dst.Close()

	hasher := sha256.New()
	size, err := io.Copy(io.MultiWriter(dst, hasher), src)
	if err != nil {
		_ = os.Remove(absolutePath)
		return StoredFile{}, err
	}

	mimeType := file.Header.Get("Content-Type")
	if mimeType == "" {
		if detected := mime.TypeByExtension(ext); detected != "" {
			mimeType = detected
		} else {
			mimeType = "application/octet-stream"
		}
	}

	return StoredFile{
		ObjectKey:    objectKey,
		RelativePath: relativePath,
		AbsolutePath: absolutePath,
		PublicPath:   PublicPath(relativePath),
		MimeType:     mimeType,
		Ext:          ext,
		Size:         size,
		SHA256:       hex.EncodeToString(hasher.Sum(nil)),
	}, nil
}

func DownloadRemoteFile(rawURL string, ownerID uint, purpose, visibility string, maxSize int64, allowedExts []string) (StoredFile, error) {
	client := http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(rawURL)
	if err != nil {
		return StoredFile{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return StoredFile{}, fmt.Errorf("HTTP request failed, status code: %d", resp.StatusCode)
	}
	if resp.ContentLength > maxSize {
		return StoredFile{}, fmt.Errorf("file too large: %d bytes", resp.ContentLength)
	}

	ext := strings.ToLower(filepath.Ext(resp.Request.URL.Path))
	if ext == "" {
		exts, _ := mime.ExtensionsByType(resp.Header.Get("Content-Type"))
		if len(exts) > 0 {
			ext = exts[0]
		}
	}
	if ext == "" {
		ext = ".ico"
	}
	if len(allowedExts) > 0 && !contains(allowedExts, ext) {
		return StoredFile{}, fmt.Errorf("unsupported file extension: %s", ext)
	}

	objectKey := uuid.NewString()
	relativePath := buildRelativePath(ownerID, purpose, visibility, objectKey, ext)
	absolutePath := filepath.Join(UploadsPath(), filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(absolutePath), 0755); err != nil {
		return StoredFile{}, err
	}

	dst, err := os.OpenFile(absolutePath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err != nil {
		return StoredFile{}, err
	}
	defer dst.Close()

	limited := io.LimitReader(resp.Body, maxSize+1)
	hasher := sha256.New()
	size, err := io.Copy(io.MultiWriter(dst, hasher), limited)
	if err != nil {
		_ = os.Remove(absolutePath)
		return StoredFile{}, err
	}
	if size > maxSize {
		_ = os.Remove(absolutePath)
		return StoredFile{}, fmt.Errorf("file too large: %d bytes", size)
	}

	mimeType := resp.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = mime.TypeByExtension(ext)
	}
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	return StoredFile{
		ObjectKey:    objectKey,
		RelativePath: relativePath,
		AbsolutePath: absolutePath,
		PublicPath:   PublicPath(relativePath),
		MimeType:     mimeType,
		Ext:          ext,
		Size:         size,
		SHA256:       hex.EncodeToString(hasher.Sum(nil)),
	}, nil
}

func AbsolutePath(relativePath string) string {
	return filepath.Join(UploadsPath(), filepath.FromSlash(relativePath))
}

func PublicPath(relativePath string) string {
	return "/uploads/" + strings.TrimPrefix(filepath.ToSlash(relativePath), "/")
}

func buildRelativePath(ownerID uint, purpose, visibility, objectKey, ext string) string {
	ext = strings.TrimPrefix(strings.ToLower(ext), ".")
	switch visibility {
	case VisibilityPublic:
		return fmt.Sprintf("public/gallery/%s.%s", objectKey, ext)
	case VisibilitySystem:
		return fmt.Sprintf("system/%s/%s.%s", purpose, objectKey, ext)
	default:
		return fmt.Sprintf("users/%d/%s/%s.%s", ownerID, purpose, objectKey, ext)
	}
}

func configValue(section, key, fallback string) string {
	if global.Config == nil {
		return fallback
	}
	if value := global.Config.GetValueString(section, key); value != "" {
		return value
	}
	return fallback
}

func contains(items []string, target string) bool {
	for _, item := range items {
		if strings.EqualFold(item, target) {
			return true
		}
	}
	return false
}

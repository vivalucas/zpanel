package system

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io/fs"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
	"zpanel/api/api_v1/middleware"
	"zpanel/global"
	"zpanel/lib/iniConfig"
	"zpanel/lib/storage"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"gopkg.in/ini.v1"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

type fileUploadTestEnv struct {
	db      *gorm.DB
	uploads string
	temp    string
	ownerID uint
}

type fileUploadTestResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		FileID     uint              `json:"fileId"`
		ImageURL   string            `json:"imageUrl"`
		SuccMap    map[string]string `json:"succMap"`
		ErrFiles   []string          `json:"errFiles"`
		DeletedIDs []uint            `json:"deletedIds"`
		FailedIDs  []uint            `json:"failedIds"`
	} `json:"data"`
}

type fileUploadTestInput struct {
	name string
	data []byte
}

func newFileUploadTestEnv(t *testing.T) *fileUploadTestEnv {
	t.Helper()
	root := t.TempDir()
	db, err := gorm.Open(sqlite.Open(filepath.Join(root, "uploads.sqlite")), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), NamingStrategy: schema.NamingStrategy{SingularTable: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.AutoMigrate(&models.File{}); err != nil {
		t.Fatal(err)
	}
	config := ini.Empty()
	config.Section("storage").Key("data_path").SetValue(root)
	config.Section("storage").Key("uploads_path").SetValue(filepath.Join(root, "uploads"))
	config.Section("storage").Key("temp_path").SetValue(filepath.Join(root, "temp"))
	oldDB, oldModelDB, oldConfig := global.Db, models.Db, global.Config
	global.Db, models.Db = db, db
	global.Config = &iniConfig.IniConfig{Config: config}
	t.Cleanup(func() { global.Db, models.Db, global.Config = oldDB, oldModelDB, oldConfig })
	if err := storage.EnsureRuntimeDirs(); err != nil {
		t.Fatal(err)
	}
	return &fileUploadTestEnv{db: db, uploads: storage.UploadsPath(), temp: storage.TempPath(), ownerID: 7}
}

func fileUploadTestPNG(t *testing.T, red uint8) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.SetRGBA(0, 0, color.RGBA{R: red, G: 80, B: 120, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func fileUploadTestRequest(ownerID uint, batch bool, inputs ...fileUploadTestInput) (fileUploadTestResponse, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	field := "imgfile"
	if batch {
		field = "files[]"
	}
	for _, input := range inputs {
		part, err := writer.CreateFormFile(field, input.name)
		if err != nil {
			return fileUploadTestResponse{}, err
		}
		if _, err := part.Write(input.data); err != nil {
			return fileUploadTestResponse{}, err
		}
	}
	if err := writer.Close(); err != nil {
		return fileUploadTestResponse{}, err
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/file/uploadImg", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	user := models.User{}
	user.ID = ownerID
	c.Set("userInfo", user)
	if batch {
		(&FileApi{}).UploadFiles(c)
	} else {
		(&FileApi{}).UploadImg(c)
	}
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}
	var result fileUploadTestResponse
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		return result, fmt.Errorf("decode upload response %q: %w", w.Body.String(), err)
	}
	if w.Code != 200 {
		return result, fmt.Errorf("unexpected HTTP status %d: %s", w.Code, w.Body.String())
	}
	return result, nil
}

func (e *fileUploadTestEnv) upload(t *testing.T, batch bool, inputs ...fileUploadTestInput) fileUploadTestResponse {
	t.Helper()
	response, err := fileUploadTestRequest(e.ownerID, batch, inputs...)
	if err != nil {
		t.Fatal(err)
	}
	if response.Code != 0 || len(response.Data.ErrFiles) != 0 {
		t.Fatalf("upload failed: %+v", response)
	}
	return response
}

func (e *fileUploadTestEnv) seed(t *testing.T, name string, data []byte, modify func(*models.File)) models.File {
	t.Helper()
	sum := sha256.Sum256(data)
	file := models.File{
		OwnerID: e.ownerID, Storage: "local", ObjectKey: "seed-" + name,
		RelativePath: "public/gallery/seed-" + name + ".png", OriginalName: name + ".png",
		MimeType: "image/png", Ext: ".png", Size: int64(len(data)), SHA256: hex.EncodeToString(sum[:]),
		Visibility: models.FileVisibilityPublic, Purpose: models.FilePurposeAttachment, Status: models.FileStatusActive,
	}
	if modify != nil {
		modify(&file)
	}
	if err := e.db.Create(&file).Error; err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(e.uploads, filepath.FromSlash(file.RelativePath))
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatal(err)
	}
	return file
}

func (e *fileUploadTestEnv) assertCounts(t *testing.T, records, uploadFiles int) {
	t.Helper()
	var count int64
	if err := e.db.Unscoped().Model(&models.File{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != int64(records) {
		t.Fatalf("file records: got %d, want %d", count, records)
	}
	for _, check := range []struct {
		path string
		want int
	}{{e.uploads, uploadFiles}, {e.temp, 0}} {
		got := 0
		err := filepath.WalkDir(check.path, func(_ string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if !entry.IsDir() {
				got++
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
		if got != check.want {
			t.Fatalf("files under %s: got %d, want %d", check.path, got, check.want)
		}
	}
}

func TestImageUploadReusesIdenticalContentAndOriginalName(t *testing.T) {
	e := newFileUploadTestEnv(t)
	payload := fileUploadTestPNG(t, 10)
	first := e.upload(t, false, fileUploadTestInput{"first.png", payload})
	second := e.upload(t, false, fileUploadTestInput{"renamed.jpg", payload})
	if first.Data.FileID == 0 || first.Data.ImageURL == "" || second.Data.FileID != first.Data.FileID || second.Data.ImageURL != first.Data.ImageURL {
		t.Fatalf("identical upload did not reuse ID and URL: first=%+v second=%+v", first, second)
	}
	var stored models.File
	if err := e.db.First(&stored, first.Data.FileID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.OriginalName != "first.png" {
		t.Fatalf("duplicate upload replaced original filename: %q", stored.OriginalName)
	}
	got, err := os.ReadFile(filepath.Join(e.uploads, filepath.FromSlash(stored.RelativePath)))
	if err != nil || !bytes.Equal(got, payload) {
		t.Fatalf("stored content changed: err=%v", err)
	}
	e.assertCounts(t, 1, 1)
}

func TestImageUploadKeepsWebPOriginalWithoutThumbnail(t *testing.T) {
	e := newFileUploadTestEnv(t)
	// The thumbnail decoder must reject this metadata-heavy VP8L file, while
	// disabling derivatives must not remove the existing WebP upload behavior.
	payload, err := hex.DecodeString("5249464620000000574542505650384c130000002f8fc16300bcfef73f2200000000000000000000")
	if err != nil {
		t.Fatal(err)
	}
	first := e.upload(t, false, fileUploadTestInput{"original.webp", payload})
	reused := e.upload(t, false, fileUploadTestInput{"copy.webp", payload})
	if first.Data.FileID == 0 || reused.Data.FileID != first.Data.FileID || reused.Data.ImageURL != first.Data.ImageURL {
		t.Fatalf("WebP original was not uploaded/reused: first=%+v reused=%+v", first, reused)
	}
	var file models.File
	if err := e.db.First(&file, first.Data.FileID).Error; err != nil {
		t.Fatal(err)
	}
	if file.Ext != ".webp" || file.Size != int64(len(payload)) || fileResponse(file)["src"] != first.Data.ImageURL {
		t.Fatalf("WebP original metadata changed: %+v", file)
	}
	if _, present := fileResponse(file)["thumbnailSrc"]; present {
		t.Fatal("WebP upload advertised a disabled thumbnail")
	}
	if original, err := os.ReadFile(filepath.Join(e.uploads, filepath.FromSlash(file.RelativePath))); err != nil || !bytes.Equal(original, payload) {
		t.Fatalf("WebP original bytes changed: %v", err)
	}
	e.assertCounts(t, 1, 1)
}

func TestImageAndBatchUploadsShareDeduplication(t *testing.T) {
	e := newFileUploadTestEnv(t)
	payload, other := fileUploadTestPNG(t, 10), fileUploadTestPNG(t, 20)
	first := e.upload(t, false, fileUploadTestInput{"first.png", payload})
	batch := e.upload(t, true, fileUploadTestInput{"copy-a.png", payload}, fileUploadTestInput{"copy-b.png", payload}, fileUploadTestInput{"other.png", other})
	if len(batch.Data.SuccMap) != 3 || batch.Data.SuccMap["copy-a.png"] != first.Data.ImageURL || batch.Data.SuccMap["copy-b.png"] != first.Data.ImageURL {
		t.Fatalf("batch did not reuse single-image upload: %+v", batch)
	}
	if batch.Data.SuccMap["other.png"] == "" || batch.Data.SuccMap["other.png"] == first.Data.ImageURL {
		t.Fatalf("different content reused the same file: %+v", batch)
	}
	last := e.upload(t, false, fileUploadTestInput{"other-renamed.png", other})
	if last.Data.ImageURL != batch.Data.SuccMap["other.png"] {
		t.Fatalf("single-image upload did not reuse batch upload: %+v", last)
	}
	e.assertCounts(t, 2, 2)
}

func TestImageUploadRespectsOwnerVisibilityPurposeStorageAndStatus(t *testing.T) {
	cases := []struct {
		name   string
		modify func(*models.File)
		delete bool
	}{
		{"another owner", func(file *models.File) { file.OwnerID++ }, false},
		{"private", func(file *models.File) { file.Visibility = models.FileVisibilityPrivate }, false},
		{"system visibility", func(file *models.File) { file.Visibility = models.FileVisibilitySystem }, false},
		{"another purpose", func(file *models.File) { file.Purpose = models.FilePurposeIcon }, false},
		{"another storage", func(file *models.File) { file.Storage = "remote" }, false},
		{"orphaned", func(file *models.File) { file.Status = models.FileStatusOrphaned }, false},
		{"deleted status", func(file *models.File) { file.Status = models.FileStatusDeleted }, false},
		{"delete failed", func(file *models.File) { file.Status = models.FileStatusDeleteFailed }, false},
		{"legacy without hash", func(file *models.File) { file.SHA256 = "" }, false},
		{"different recorded size", func(file *models.File) { file.Size++ }, false},
		{"soft deleted", nil, true},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			e := newFileUploadTestEnv(t)
			payload := fileUploadTestPNG(t, 10)
			old := e.seed(t, "old", payload, test.modify)
			if test.delete {
				if err := e.db.Delete(&old).Error; err != nil {
					t.Fatal(err)
				}
			}
			response := e.upload(t, false, fileUploadTestInput{"new.png", payload})
			if response.Data.FileID == old.ID || response.Data.ImageURL == storage.PublicPath(old.RelativePath) {
				t.Fatalf("ineligible file was reused: %+v", response)
			}
			e.assertCounts(t, 2, 2)
		})
	}
}

func TestImageUploadDoesNotReuseMissingOrDamagedFiles(t *testing.T) {
	for _, kind := range []string{"missing", "directory", "wrong size", "wrong content"} {
		t.Run(kind, func(t *testing.T) {
			e := newFileUploadTestEnv(t)
			payload := fileUploadTestPNG(t, 10)
			old := e.seed(t, "old", payload, nil)
			path := filepath.Join(e.uploads, filepath.FromSlash(old.RelativePath))
			wantFiles := 2
			switch kind {
			case "missing", "directory":
				if err := os.Remove(path); err != nil {
					t.Fatal(err)
				}
				if kind == "directory" {
					if err := os.Mkdir(path, 0755); err != nil {
						t.Fatal(err)
					}
				}
				wantFiles = 1
			case "wrong size":
				if err := os.WriteFile(path, []byte("damaged"), 0644); err != nil {
					t.Fatal(err)
				}
			case "wrong content":
				damaged := append([]byte(nil), payload...)
				damaged[len(damaged)-1] ^= 1
				if err := os.WriteFile(path, damaged, 0644); err != nil {
					t.Fatal(err)
				}
			}
			before, beforeErr := os.ReadFile(path)
			response := e.upload(t, false, fileUploadTestInput{"new.png", payload})
			if response.Data.FileID == old.ID {
				t.Fatalf("invalid stored file was reused: %+v", response)
			}
			after, afterErr := os.ReadFile(path)
			if (beforeErr == nil) != (afterErr == nil) || !bytes.Equal(before, after) {
				t.Fatal("upload changed the old file")
			}
			var retained models.File
			if err := e.db.Unscoped().First(&retained, old.ID).Error; err != nil {
				t.Fatal(err)
			}
			if retained.Status != old.Status || retained.SHA256 != old.SHA256 || retained.Size != old.Size || retained.RelativePath != old.RelativePath || retained.DeletedAt.Valid {
				t.Fatalf("upload changed the invalid historical record: %+v", retained)
			}
			e.assertCounts(t, 2, wantFiles)
		})
	}
}

func TestImageUploadFindsValidCopyAfterInvalidCandidate(t *testing.T) {
	e := newFileUploadTestEnv(t)
	payload := fileUploadTestPNG(t, 10)
	invalid := e.seed(t, "invalid", payload, nil)
	valid := e.seed(t, "valid", payload, nil)
	if err := os.Remove(filepath.Join(e.uploads, filepath.FromSlash(invalid.RelativePath))); err != nil {
		t.Fatal(err)
	}
	response := e.upload(t, false, fileUploadTestInput{"renamed.png", payload})
	if response.Data.FileID != valid.ID || response.Data.ImageURL != storage.PublicPath(valid.RelativePath) {
		t.Fatalf("valid historical copy was not reused: %+v", response)
	}
	e.assertCounts(t, 2, 1)
}

func TestConcurrentImageAndBatchUploadsKeepOneCopy(t *testing.T) {
	e := newFileUploadTestEnv(t)
	payload := fileUploadTestPNG(t, 10)
	const requests = 12
	type outcome struct {
		response fileUploadTestResponse
		batch    bool
		name     string
		err      error
	}
	start := make(chan struct{})
	results := make(chan outcome, requests)
	for i := 0; i < requests; i++ {
		go func(i int) {
			<-start
			name := fmt.Sprintf("copy-%d.png", i)
			batch := i%2 == 0
			response, err := fileUploadTestRequest(e.ownerID, batch, fileUploadTestInput{name, payload})
			results <- outcome{response: response, batch: batch, name: name, err: err}
		}(i)
	}
	close(start)
	var expectedURL string
	var expectedID uint
	for i := 0; i < requests; i++ {
		result := <-results
		if result.err != nil || result.response.Code != 0 || len(result.response.Data.ErrFiles) != 0 {
			t.Errorf("concurrent upload failed: response=%+v err=%v", result.response, result.err)
			continue
		}
		url := result.response.Data.ImageURL
		if result.batch {
			url = result.response.Data.SuccMap[result.name]
		} else if expectedID == 0 {
			expectedID = result.response.Data.FileID
		} else if result.response.Data.FileID != expectedID {
			t.Errorf("concurrent uploads returned different IDs: got %d want %d", result.response.Data.FileID, expectedID)
		}
		if expectedURL == "" {
			expectedURL = url
		}
		if url == "" || url != expectedURL {
			t.Errorf("concurrent uploads returned different URLs: got %q want %q", url, expectedURL)
		}
	}
	if expectedID == 0 {
		t.Error("no single-image upload returned a file ID")
	}
	e.assertCounts(t, 1, 1)
}

func TestUploadDatabaseFailuresCleanOnlyNewFiles(t *testing.T) {
	for _, stage := range []string{"query", "create"} {
		for _, batch := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/batch=%t", stage, batch), func(t *testing.T) {
				e := newFileUploadTestEnv(t)
				keptPayload := fileUploadTestPNG(t, 20)
				kept := e.seed(t, "kept", keptPayload, nil)
				callbackName := "test:file-upload-failure"
				fail := func(tx *gorm.DB) {
					if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "file" {
						tx.AddError(errors.New("simulated file " + stage + " failure"))
					}
				}
				var remove func() error
				if stage == "query" {
					if err := e.db.Callback().Query().Before("gorm:query").Register(callbackName, fail); err != nil {
						t.Fatal(err)
					}
					remove = func() error { return e.db.Callback().Query().Remove(callbackName) }
				} else {
					if err := e.db.Callback().Create().Before("gorm:create").Register(callbackName, fail); err != nil {
						t.Fatal(err)
					}
					remove = func() error { return e.db.Callback().Create().Remove(callbackName) }
				}
				t.Cleanup(func() { _ = remove() })
				response, err := fileUploadTestRequest(e.ownerID, batch, fileUploadTestInput{"failed.png", fileUploadTestPNG(t, 10)})
				if err != nil {
					t.Fatal(err)
				}
				if err := remove(); err != nil {
					t.Fatal(err)
				}
				if batch {
					if response.Code != 0 || len(response.Data.SuccMap) != 0 || len(response.Data.ErrFiles) != 1 || response.Data.ErrFiles[0] != "failed.png" {
						t.Fatalf("batch upload did not report failed file: %+v", response)
					}
				} else if response.Code != 1200 {
					t.Fatalf("single-image upload did not report database failure: %+v", response)
				}
				got, err := os.ReadFile(filepath.Join(e.uploads, filepath.FromSlash(kept.RelativePath)))
				if err != nil || !bytes.Equal(got, keptPayload) {
					t.Fatalf("failure changed pre-existing file: err=%v", err)
				}
				e.assertCounts(t, 1, 1)
			})
		}
	}
}

func (e *fileUploadTestEnv) enableUsage(t *testing.T) {
	t.Helper()
	if err := e.db.AutoMigrate(&models.User{}, &models.ItemIcon{}, &models.UserConfig{}, &models.ModuleConfig{}, &models.SystemSetting{}, &models.FileReference{}); err != nil {
		t.Fatal(err)
	}
}

func fileUploadTestDelete(ownerID, fileID uint) (fileUploadTestResponse, error) {
	router := gin.New()
	router.POST("/api/file/deletes", func(c *gin.Context) {
		user := models.User{}
		user.ID = ownerID
		c.Set("userInfo", user)
	}, middleware.ResourceMutation, (&FileApi{}).Deletes)
	w := httptest.NewRecorder()
	request := httptest.NewRequest("POST", "/api/file/deletes", strings.NewReader(fmt.Sprintf(`{"ids":[%d]}`, fileID)))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, request)
	var response fileUploadTestResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		return response, fmt.Errorf("decode delete response %q: %w", w.Body.String(), err)
	}
	return response, nil
}

func TestReusedImageRemainsProtectedByWallpaperReference(t *testing.T) {
	e := newFileUploadTestEnv(t)
	e.enableUsage(t)
	payload := fileUploadTestPNG(t, 10)
	first := e.upload(t, false, fileUploadTestInput{"wallpaper.png", payload})
	reused := e.upload(t, false, fileUploadTestInput{"copy.png", payload})
	if reused.Data.FileID != first.Data.FileID {
		t.Fatal("duplicate image did not reuse the wallpaper file")
	}
	config := models.UserConfig{
		UserId: e.ownerID, WallpaperFileID: &first.Data.FileID,
		PanelJson: fmt.Sprintf(`{"backgroundImageSrc":%q}`, first.Data.ImageURL),
	}
	if err := e.db.Create(&config).Error; err != nil {
		t.Fatal(err)
	}
	response, err := fileUploadTestDelete(e.ownerID, reused.Data.FileID)
	if err != nil || response.Code != 1200 {
		t.Fatalf("referenced reused image could be deleted: response=%+v err=%v", response, err)
	}
	e.assertCounts(t, 1, 1)
	if err := e.db.Model(&models.UserConfig{}).Where("user_id=?", e.ownerID).Updates(map[string]interface{}{"panel_json": "{}", "wallpaper_file_id": nil}).Error; err != nil {
		t.Fatal(err)
	}
	response, err = fileUploadTestDelete(e.ownerID, first.Data.FileID)
	if err != nil || response.Code != 0 || len(response.Data.DeletedIDs) != 1 || response.Data.DeletedIDs[0] != first.Data.FileID || len(response.Data.FailedIDs) != 0 {
		t.Fatalf("unreferenced reused image could not be deleted: response=%+v err=%v", response, err)
	}
	e.assertCounts(t, 1, 0)
	newUpload := e.upload(t, false, fileUploadTestInput{"again.png", payload})
	if newUpload.Data.FileID == first.Data.FileID || newUpload.Data.ImageURL == first.Data.ImageURL {
		t.Fatalf("upload reused a deleted file: %+v", newUpload)
	}
	e.assertCounts(t, 2, 1)
}

func TestImageUploadWaitsForInProgressDeletionBeforeReusing(t *testing.T) {
	e := newFileUploadTestEnv(t)
	e.enableUsage(t)
	// Multiple connections let a broken upload lock read the old file while
	// deletion holds its read transaction, rather than hiding the race in SQLite.
	sqlDB, err := e.db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(4)
	payload := fileUploadTestPNG(t, 10)
	old := e.seed(t, "old", payload, nil)
	deletionRead, resumeDeletion := make(chan struct{}), make(chan struct{})
	var pauseOnce, resumeOnce sync.Once
	resume := func() { resumeOnce.Do(func() { close(resumeDeletion) }) }
	t.Cleanup(resume)
	callbackName := "test:pause-file-deletion"
	if err := e.db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "file" && strings.Contains(tx.Statement.SQL.String(), "id in") {
			pauseOnce.Do(func() {
				close(deletionRead)
				<-resumeDeletion
			})
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = e.db.Callback().Query().Remove(callbackName) })
	type outcome struct {
		response fileUploadTestResponse
		err      error
	}
	deleteDone := make(chan outcome, 1)
	go func() {
		response, err := fileUploadTestDelete(e.ownerID, old.ID)
		deleteDone <- outcome{response, err}
	}()
	select {
	case <-deletionRead:
	case <-time.After(5 * time.Second):
		t.Fatal("deletion did not reach its locked file lookup")
	}
	uploadDone := make(chan outcome, 1)
	go func() {
		response, err := fileUploadTestRequest(e.ownerID, false, fileUploadTestInput{"copy.png", payload})
		uploadDone <- outcome{response, err}
	}()
	var uploadResult outcome
	uploadReturnedEarly := false
	select {
	case uploadResult = <-uploadDone:
		uploadReturnedEarly = true
	case <-time.After(100 * time.Millisecond):
	}
	resume()
	deleteResult := <-deleteDone
	if !uploadReturnedEarly {
		uploadResult = <-uploadDone
	}
	if uploadReturnedEarly {
		t.Error("upload reused a file while deletion was still holding the mutation lock")
	}
	if deleteResult.err != nil || deleteResult.response.Code != 0 || len(deleteResult.response.Data.DeletedIDs) != 1 {
		t.Fatalf("deletion failed: response=%+v err=%v", deleteResult.response, deleteResult.err)
	}
	if uploadResult.err != nil || uploadResult.response.Code != 0 || uploadResult.response.Data.FileID == old.ID || uploadResult.response.Data.ImageURL == storage.PublicPath(old.RelativePath) {
		t.Fatalf("upload returned the deleted file: response=%+v err=%v", uploadResult.response, uploadResult.err)
	}
	e.assertCounts(t, 2, 1)
}

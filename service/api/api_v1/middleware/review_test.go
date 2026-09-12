package middleware

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"net/http/httptest"
	"testing"
	"zpanel/global"
	"zpanel/models"
)

func TestCaptchaRateLimitIsSeparateAndIgnoresForwardedIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.SetTrustedProxies(nil)
	engine.GET("/captcha", CaptchaRateLimit, func(c *gin.Context) { c.JSON(200, gin.H{"code": 0}) })
	engine.GET("/login", LoginRateLimit, func(c *gin.Context) { c.JSON(200, gin.H{"code": 0}) })
	for i := 0; i < 31; i++ {
		req := httptest.NewRequest("GET", "/captcha", nil)
		req.RemoteAddr = "192.0.2.123:1234"
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, req)
		var response struct{ Code int }
		json.Unmarshal(recorder.Body.Bytes(), &response)
		if (i < 30 && response.Code != 0) || (i == 30 && response.Code != 1008) {
			t.Fatalf("wrong limit at %d: %d", i, response.Code)
		}
	}
	req := httptest.NewRequest("GET", "/login", nil)
	req.RemoteAddr = "192.0.2.123:1234"
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, req)
	var response struct{ Code int }
	json.Unmarshal(recorder.Body.Bytes(), &response)
	if response.Code != 0 {
		t.Fatal("captcha exhausted login budget")
	}
	ipRecordsMu.Lock()
	delete(ipRecords, "captcha:192.0.2.123")
	delete(ipRecords, "login:192.0.2.123")
	ipRecordsMu.Unlock()
}

func TestRejectDeletedLocalImageReference(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	db.AutoMigrate(&models.File{})
	old := global.Db
	global.Db = db
	t.Cleanup(func() { global.Db = old })
	file := models.File{RelativePath: "public/gallery/test.png", ObjectKey: "test", OriginalName: "test.png", Status: models.FileStatusActive}
	db.Create(&file)
	value := map[string]interface{}{"panel": map[string]interface{}{"backgroundImageSrc": "/uploads/public/gallery/test.png"}}
	if err := checkLocalFiles(value); err != nil {
		t.Fatal(err)
	}
	db.Delete(&file)
	if checkLocalFiles(value) == nil {
		t.Fatal("accepted deleted image")
	}
}

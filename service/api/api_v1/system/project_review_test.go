package system

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"zpanel/api/api_v1/openness"
	"zpanel/global"
	"zpanel/lib/cache"
	"zpanel/lib/cmn"
	"zpanel/lib/cmn/systemSetting"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func settingsReviewDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Session{}, &models.SystemSetting{}); err != nil {
		t.Fatal(err)
	}
	oldDB, oldModelDB, oldSettings := global.Db, models.Db, global.SystemSetting
	global.Db, models.Db = db, db
	global.SystemSetting = &systemSetting.SystemSettingCache{Cache: cache.NewGoCache[interface{}](time.Minute, 0)}
	t.Cleanup(func() { global.Db, models.Db, global.SystemSetting = oldDB, oldModelDB, oldSettings })
	return db
}

func reviewRequest(t *testing.T, handler func(*gin.Context), body string) map[string]interface{} {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/review", bytes.NewBufferString(body))
	handler(c)
	var result map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestSettingsFailuresDoNotDisableCaptchaOrOverwriteConfiguration(t *testing.T) {
	db := settingsReviewDB(t)
	stored := models.SystemSetting{ConfigName: systemSetting.SYSTEM_APPLICATION, ConfigValue: `{"loginCaptcha":true`}
	db.Create(&stored)
	login := reviewRequest(t, LoginApi{}.Login, `{"username":"review","password":"example-password"}`)
	if login["code"] != float64(1200) {
		t.Fatalf("login ignored invalid settings: %v", login)
	}
	result := reviewRequest(t, (&openness.Openness{}).LoginConfig, "{}")
	if result["code"] != float64(1200) {
		t.Fatalf("configuration read reported success: %v", result)
	}
	var after models.SystemSetting
	db.First(&after, stored.ID)
	if after.ConfigValue != stored.ConfigValue {
		t.Fatal("read overwrote damaged configuration")
	}
	db.Exec("ALTER TABLE system_settings RENAME TO unavailable_settings")
	if reviewRequest(t, LoginApi{}.Login, `{"username":"review","password":"example-password"}`)["code"] != float64(1200) {
		t.Fatal("database error disabled captcha")
	}
}

func TestSiteSettingsAreAtomicAndPreserveApplicationFields(t *testing.T) {
	db := settingsReviewDB(t)
	global.SystemSetting.Set(systemSetting.SITE_SETTING, systemSetting.SiteSetting{SiteTitle: "Before"})
	global.SystemSetting.Set(systemSetting.SYSTEM_APPLICATION, systemSetting.ApplicationSetting{WebSiteUrl: "https://example.com"})
	db.Exec(`CREATE TRIGGER fail_settings BEFORE UPDATE ON system_settings WHEN NEW.config_name='system_application' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END`)
	result := reviewRequest(t, (&About{}).SetSiteSetting, `{"siteTitle":"After","loginCaptcha":true}`)
	if result["code"] != float64(1200) {
		t.Fatal(result)
	}
	var site systemSetting.SiteSetting
	global.SystemSetting.GetValueByInterface(systemSetting.SITE_SETTING, &site)
	if site.SiteTitle != "Before" {
		t.Fatal("partial save survived rollback")
	}
	db.Exec("DROP TRIGGER fail_settings")
	if reviewRequest(t, (&About{}).SetSiteSetting, `{"siteTitle":"After","loginCaptcha":true}`)["code"] != float64(0) {
		t.Fatal("valid save failed")
	}
	if err := global.SystemSetting.GetValueByInterface(systemSetting.SITE_SETTING, &site); err != nil || site.SiteTitle != "After" {
		t.Fatalf("successful save did not update existing site settings: %+v, %v", site, err)
	}
	var app systemSetting.ApplicationSetting
	global.SystemSetting.GetValueByInterface(systemSetting.SYSTEM_APPLICATION, &app)
	if !app.LoginCaptcha || app.WebSiteUrl != "https://example.com" {
		t.Fatal("save lost other application fields")
	}
}

func TestWrittenPasswordCanBeUsedForLogin(t *testing.T) {
	db := settingsReviewDB(t)
	password := strings.Repeat("x", 72)
	hash, err := cmn.PasswordEncryption(password)
	if err != nil {
		t.Fatal(err)
	}
	db.Create(&models.User{Username: "review", Password: hash, Role: 2, Status: 1})
	if result := reviewRequest(t, LoginApi{}.Login, `{"username":"review","password":"`+password+`"}`); result["code"] != float64(0) {
		t.Fatal(result)
	}
}

package middleware

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gopkg.in/ini.v1"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"net/http/httptest"
	"testing"
	"time"
	"zpanel/api/api_v1/common/base"
	"zpanel/global"
	"zpanel/lib/cache"
	"zpanel/lib/iniConfig"
	"zpanel/lib/language"
	"zpanel/models"
)

func authReviewDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Session{}, &models.UserConfig{}); err != nil {
		t.Fatal(err)
	}
	oldDB, oldCache, oldLang, oldLog := global.Db, global.UserToken, global.Lang, global.Logger
	global.Db = db
	global.UserToken = cache.NewGoCache[models.User](time.Minute, 0)
	global.Lang = &language.LangStructObj{LangContet: &iniConfig.IniConfig{Config: ini.Empty()}}
	global.Logger = zap.NewNop().Sugar()
	t.Cleanup(func() { global.Db, global.UserToken, global.Lang, global.Logger = oldDB, oldCache, oldLang, oldLog })
	return db
}

func TestStaleCacheCannotAuthorizeRevokedSessionOrOldRole(t *testing.T) {
	db := authReviewDB(t)
	user := models.User{Username: "review", Password: "hash", Role: 1, Status: 1}
	db.Create(&user)
	session, token := models.NewSession(user.ID, "", "")
	db.Create(&session)
	global.UserToken.SetDefault(token, user)
	engine := gin.New()
	engine.POST("/auth", LoginInterceptor, func(c *gin.Context) {
		u, _ := base.GetCurrentUserInfo(c)
		c.JSON(200, gin.H{"code": 0, "role": u.Role})
	})
	query := func() map[string]interface{} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/auth", nil)
		req.Header.Set("token", token)
		engine.ServeHTTP(w, req)
		var result map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &result)
		return result
	}
	db.Model(&user).Update("role", 2)
	if query()["role"] != float64(2) {
		t.Fatal("stale cache retained administrator role")
	}
	db.Model(&session).Update("revoked_at", time.Now())
	if query()["code"] != float64(1001) {
		t.Fatal("stale cache authorized revoked session")
	}
}

func TestPublicMonitorRequiresBothVisibilityFlags(t *testing.T) {
	db := authReviewDB(t)
	for _, tc := range []struct {
		panel   string
		public  bool
		allowed bool
	}{
		{`{"systemMonitorShow":false,"systemMonitorPublicVisitModeShow":false}`, true, false},
		{`{"systemMonitorShow":true,"systemMonitorPublicVisitModeShow":false}`, true, false},
		{`{"systemMonitorShow":true,"systemMonitorPublicVisitModeShow":true}`, true, true},
		{`{"systemMonitorShow":"true","systemMonitorPublicVisitModeShow":true}`, true, false},
		{`{`, true, false},
		{`{`, false, true},
	} {
		db.Where("user_id=?", 1).Delete(&models.UserConfig{})
		db.Create(&models.UserConfig{UserId: 1, PanelJson: tc.panel})
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("userInfo", models.User{BaseModel: models.BaseModel{ID: 1}})
		if tc.public {
			c.Set(base.GIN_GET_VISIT_MODE, base.VISIT_MODE_PUBLIC)
		}
		MonitorAccess(c)
		if c.IsAborted() == tc.allowed {
			t.Fatalf("wrong monitor access: %+v", tc)
		}
	}
}

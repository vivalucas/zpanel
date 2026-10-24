package system

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"zpanel/global"
	"zpanel/lib/iniConfig"
	"zpanel/lib/language"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"gopkg.in/ini.v1"
)

func TestProfilePreservesUnchangedLegacyNicknameButValidatesRenames(t *testing.T) {
	db := settingsReviewDB(t)
	oldLang := global.Lang
	global.Lang = &language.LangStructObj{LangContet: &iniConfig.IniConfig{Config: ini.Empty()}}
	t.Cleanup(func() { global.Lang = oldLang })
	user := models.User{Username: "admin@zpanel.local", Name: "admin@zpanel.local", HeadImage: "/before.png", Role: 1, Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	update := func(name, avatar string) int {
		t.Helper()
		var current models.User
		if err := db.First(&current, user.ID).Error; err != nil {
			t.Fatal(err)
		}
		body, err := json.Marshal(map[string]string{"name": name, "headImage": avatar})
		if err != nil {
			t.Fatal(err)
		}
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest("POST", "/api/user/updateInfo", bytes.NewReader(body))
		c.Set("userInfo", current)
		(&UserApi{}).UpdateInfo(c)
		var response struct{ Code int }
		if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		return response.Code
	}
	assertStored := func(name, avatar string) {
		t.Helper()
		var stored models.User
		if err := db.First(&stored, user.ID).Error; err != nil {
			t.Fatal(err)
		}
		if stored.Name != name || stored.HeadImage != avatar {
			t.Fatalf("unexpected profile after update: name=%q avatar=%q", stored.Name, stored.HeadImage)
		}
	}

	if code := update(user.Name, "/avatar.png"); code != 0 {
		t.Fatalf("unchanged legacy nickname blocked avatar update: code=%d", code)
	}
	assertStored(user.Name, "/avatar.png")
	for _, invalid := range []string{"", "ab", strings.Repeat("x", 16), strings.Repeat("名", 16)} {
		if code := update(invalid, "/should-not-save.png"); code == 0 {
			t.Fatalf("invalid renamed nickname %q returned code=%d", invalid, code)
		}
		assertStored(user.Name, "/avatar.png")
	}
	if code := update("New nickname", "/renamed.png"); code != 0 {
		t.Fatalf("valid renamed nickname failed: code=%d", code)
	}
	assertStored("New nickname", "/renamed.png")
	if code := update(user.Name, "/should-not-restore.png"); code == 0 {
		t.Fatalf("old legacy nickname remained exempt after rename: code=%d", code)
	}
	assertStored("New nickname", "/renamed.png")
}

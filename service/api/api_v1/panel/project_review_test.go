package panel

import (
	"bytes"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"gopkg.in/ini.v1"
	"net/http/httptest"
	"testing"
	"zpanel/global"
	"zpanel/lib/iniConfig"
	"zpanel/lib/language"
	"zpanel/models"
)

func panelReviewRequest(t *testing.T, userID uint, handler func(*gin.Context), payload string) map[string]interface{} {
	t.Helper()
	oldLang := global.Lang
	global.Lang = &language.LangStructObj{LangContet: &iniConfig.IniConfig{Config: ini.Empty()}}
	t.Cleanup(func() { global.Lang = oldLang })
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("userInfo", models.User{BaseModel: models.BaseModel{ID: userID}, Status: 1, Role: 2})
	c.Request = httptest.NewRequest("POST", "/review", bytes.NewBufferString(payload))
	handler(c)
	var result map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestLegacyPanelUsesRecoverableDefaultsWithoutMutatingStorage(t *testing.T) {
	db := newPanelTestDB(t)
	db.AutoMigrate(&models.UserConfig{})
	old := global.Db
	global.Db = db
	t.Cleanup(func() { global.Db = old })
	db.Create(&models.UserConfig{UserId: 1, PanelJson: `{"iconTextColor":42,"logoText":"Keep"}`, SearchEngineJson: "{}"})
	result := panelReviewRequest(t, 1, (&UserConfig{}).Get, "{}")
	data := result["data"].(map[string]interface{})
	if data["panel"].(map[string]interface{})["logoText"] != "Keep" || len(data["panelWarnings"].([]interface{})) != 1 {
		t.Fatal(result)
	}
	var cfg models.UserConfig
	db.First(&cfg, "user_id=?", 1)
	if cfg.PanelJson != `{"iconTextColor":42,"logoText":"Keep"}` {
		t.Fatal("read mutated legacy settings")
	}
	if panelReviewRequest(t, 1, (&UserConfig{}).Set, `{"userId":2,"panel":{"logoText":"Repaired"}}`)["code"] != float64(0) {
		t.Fatal("repair failed")
	}
	db.First(&cfg, "user_id=?", 1)
	if cfg.PanelJson != `{"logoText":"Repaired"}` {
		t.Fatal("repair changed another owner")
	}
	for _, raw := range []string{"null", "[]", `{"logoText":`} {
		db.Model(&models.UserConfig{}).Where("user_id=?", 1).Update("panel_json", raw)
		result := panelReviewRequest(t, 1, (&UserConfig{}).Get, "{}")
		data := result["data"].(map[string]interface{})
		if len(data["panelWarnings"].([]interface{})) != 1 {
			t.Fatalf("missing repair warning for %s", raw)
		}
		db.First(&cfg, "user_id=?", 1)
		if cfg.PanelJson != raw {
			t.Fatal("read rewrote malformed JSON")
		}
	}
}

func TestGroupCreationNeverSavesClientUserAssociation(t *testing.T) {
	db := newPanelTestDB(t)
	old := global.Db
	global.Db = db
	t.Cleanup(func() { global.Db = old })
	result := panelReviewRequest(t, 2, (&ItemIconGroup{}).Edit, `{"title":"Own","userId":1,"user":{"username":"injected-admin","password":"hash","role":1,"status":1}}`)
	if result["code"] != float64(0) {
		t.Fatal(result)
	}
	var users int64
	db.Model(&models.User{}).Where("username=?", "injected-admin").Count(&users)
	if users != 0 {
		t.Fatal("created a client-supplied user")
	}
	var group models.ItemIconGroup
	db.First(&group)
	if group.UserId != 2 {
		t.Fatal("client changed owner")
	}
}

func TestInvalidPanelImportLeavesNoReceiptOrWrites(t *testing.T) {
	db := newPanelTestDB(t)
	db.AutoMigrate(&models.ImportReceipt{}, &models.UserConfig{})
	if err := importConfig(db, 1, importRequest{RequestID: "review-invalid-1234", Mode: "append", Panel: map[string]interface{}{"iconTextColor": float64(42)}}); err == nil {
		t.Fatal("accepted invalid color")
	}
	var count int64
	db.Model(&models.ImportReceipt{}).Count(&count)
	if count != 0 {
		t.Fatal("invalid import left a receipt")
	}
	db.Model(&models.UserConfig{}).Count(&count)
	if count != 0 {
		t.Fatal("invalid import changed configuration")
	}
}

func TestNavigationSnapshotAndMoveStayWithinOwner(t *testing.T) {
	db := newPanelTestDB(t)
	old := global.Db
	global.Db = db
	t.Cleanup(func() { global.Db = old })
	groups := []models.ItemIconGroup{{Title: "Source", UserId: 1}, {Title: "Destination", UserId: 1}, {Title: "Private", UserId: 2}}
	db.Create(&groups)
	item := models.ItemIcon{Title: "LAN app", UserId: 1, ItemIconGroupId: int(groups[0].ID), LanUrl: "http://192.168.1.10", OpenMethod: 2, IconJson: `{"itemType":1}`}
	db.Create(&item)
	move := func(target uint) map[string]interface{} {
		payload, _ := json.Marshal(map[string]interface{}{"ids": []uint{groups[0].ID}, "moveToGroupId": target})
		return panelReviewRequest(t, 1, (&ItemIconGroup{}).Deletes, string(payload))
	}
	if move(groups[2].ID)["code"] == float64(0) {
		t.Fatal("moved items into another account")
	}
	if move(groups[1].ID)["code"] != float64(0) {
		t.Fatal("valid move failed")
	}
	db.First(&item, item.ID)
	if item.ItemIconGroupId != int(groups[1].ID) {
		t.Fatal("move deleted item")
	}
	result := panelReviewRequest(t, 1, (&ItemIconGroup{}).GetNavigation, "{}")
	list := result["data"].([]interface{})
	if len(list) != 1 || len(list[0].(map[string]interface{})["items"].([]interface{})) != 1 {
		t.Fatal("snapshot is incomplete or leaks another account")
	}
}

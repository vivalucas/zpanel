package panel

import (
	"bytes"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"net/http/httptest"
	"testing"
	"zpanel/global"
	"zpanel/models"
)

func TestImportAtomicRetryAndReplace(t *testing.T) {
	db := newPanelTestDB(t)
	if err := db.AutoMigrate(&models.ImportReceipt{}, &models.UserConfig{}); err != nil {
		t.Fatal(err)
	}
	old := models.ItemIconGroup{Title: "Existing", UserId: 1}
	db.Create(&old)
	cfg := models.UserConfig{UserId: 1, PanelJson: `{"keep":true}`, SearchEngineJson: `{"existing":true}`}
	db.Create(&cfg)
	groups := []importGroup{{Title: "Imported", Sort: 1, Children: []models.ItemIcon{{Title: "App", Url: "https://example.com", Sort: 0}}}}
	req := importRequest{RequestID: "request-1234567890", Mode: "replace", Icons: &groups, Panel: map[string]interface{}{"new": true}}
	if err := db.Exec(`CREATE TRIGGER fail_items BEFORE INSERT ON item_icons BEGIN SELECT RAISE(ABORT, 'simulated failure'); END`).Error; err != nil {
		t.Fatal(err)
	}
	if err := importConfig(db, 1, req); err == nil {
		t.Fatal("expected failure")
	}
	var count int64
	db.Model(&models.ItemIconGroup{}).Where("title=?", "Existing").Count(&count)
	if count != 1 {
		t.Fatal("replace did not roll back existing groups")
	}
	db.Model(&models.ImportReceipt{}).Count(&count)
	if count != 0 {
		t.Fatal("failed import left receipt")
	}
	db.Exec("DROP TRIGGER fail_items")
	for i := 0; i < 2; i++ {
		if err := importConfig(db, 1, req); err != nil {
			t.Fatal(err)
		}
	}
	db.Model(&models.ItemIconGroup{}).Where("user_id=?", 1).Count(&count)
	if count != 1 {
		t.Fatalf("retry duplicated groups: %d", count)
	}
	db.Model(&models.ItemIcon{}).Count(&count)
	if count != 1 {
		t.Fatal("retry duplicated items")
	}
	db.First(&cfg, "user_id=?", 1)
	if cfg.SearchEngineJson != `{"existing":true}` {
		t.Fatal("import overwrote unrelated settings")
	}
	var panel map[string]interface{}
	json.Unmarshal([]byte(cfg.PanelJson), &panel)
	if panel["keep"] != true || panel["new"] != true {
		t.Fatal("style merge failed")
	}
	req.Mode = "append"
	if err := importConfig(db, 1, req); err == nil {
		t.Fatal("same request ID accepted changed payload")
	}
}

func TestLastAdministratorCannotBeDemoted(t *testing.T) {
	db := newPanelTestDB(t)
	if err := db.AutoMigrate(&models.User{}, &models.Session{}); err != nil {
		t.Fatal(err)
	}
	oldDb, oldModelDb := global.Db, models.Db
	global.Db, models.Db = db, db
	t.Cleanup(func() { global.Db, models.Db = oldDb, oldModelDb })
	admin := models.User{Username: "admin", Password: "hash", Role: 1, Status: 1}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(map[string]interface{}{"id": admin.ID, "username": "admin", "role": 2})
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/update", bytes.NewReader(body))
	UsersApi{}.Update(c)
	var response struct{ Code int }
	json.Unmarshal(recorder.Body.Bytes(), &response)
	if response.Code != 1201 {
		t.Fatalf("expected administrator protection: %s", recorder.Body.String())
	}
	db.First(&admin, admin.ID)
	if admin.Role != 1 {
		t.Fatal("demotion was not rolled back")
	}
}

package panel

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"zpanel/global"
	"zpanel/lib/iniConfig"
	"zpanel/lib/language"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"gopkg.in/ini.v1"
	"gorm.io/gorm"
)

func TestItemIconMove(t *testing.T) {
	for _, scenario := range []struct {
		name   string
		target int
		item   uint
		code   int
	}{
		{"append", 2, 1, 0},
		{"empty destination", 3, 1, 0},
		{"same group is idempotent", 1, 1, 0},
		{"other user's destination", 4, 1, -1},
		{"missing destination", 999, 1, -1},
		{"other user's item", 2, 4, 1005},
		{"missing item", 2, 999, 1005},
		{"invalid destination", -1, 1, -1},
		{"missing item ID", 2, 0, -1},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			db := newPanelTestDB(t)
			previous := global.Db
			global.Db = db
			t.Cleanup(func() { global.Db = previous })
			groups := []models.ItemIconGroup{
				{BaseModel: models.BaseModel{ID: 1}, Title: "Source", UserId: 1},
				{BaseModel: models.BaseModel{ID: 2}, Title: "Target", UserId: 1},
				{BaseModel: models.BaseModel{ID: 3}, Title: "Empty", UserId: 1},
				{BaseModel: models.BaseModel{ID: 4}, Title: "Other", UserId: 2},
			}
			if err := db.Create(&groups).Error; err != nil {
				t.Fatal(err)
			}
			items := []models.ItemIcon{
				{BaseModel: models.BaseModel{ID: 1}, UserId: 1, ItemIconGroupId: 1, Sort: 5, Title: "Keep title", Url: "https://example.com", Description: "Keep description", OpenMethod: 3, IconJson: `{"itemType":1,"text":"K"}`},
				{BaseModel: models.BaseModel{ID: 2}, UserId: 1, ItemIconGroupId: 2, Sort: 9999},
				{BaseModel: models.BaseModel{ID: 3}, UserId: 2, ItemIconGroupId: 2, Sort: 20000},
				{BaseModel: models.BaseModel{ID: 4}, UserId: 2, ItemIconGroupId: 4, Sort: 0},
			}
			if err := db.Create(&items).Error; err != nil {
				t.Fatal(err)
			}
			code := callItemMutation(t, (&ItemIcon{}).Move, map[string]interface{}{
				"id": scenario.item, "itemIconGroupId": scenario.target,
				"title": "Do not overwrite", "userId": 2, "sort": -100,
			})
			if code != scenario.code {
				t.Fatalf("code=%d, want %d", code, scenario.code)
			}
			var current models.ItemIcon
			if err := db.First(&current, 1).Error; err != nil {
				t.Fatal(err)
			}
			wantGroup, wantSort := 1, 5
			if scenario.code == 0 && scenario.target != 1 {
				wantGroup = scenario.target
				wantSort = 0
				if wantGroup == 2 {
					wantSort = 10000
				}
			}
			if current.ItemIconGroupId != wantGroup || current.Sort != wantSort || current.Title != items[0].Title || current.Url != items[0].Url || current.IconJson != items[0].IconJson || current.Description != items[0].Description || current.OpenMethod != items[0].OpenMethod || current.UserId != 1 {
				t.Fatalf("unexpected item after move: %+v", current)
			}
			if scenario.code == 0 {
				if code := callItemMutation(t, (&ItemIcon{}).Move, map[string]interface{}{"id": 1, "itemIconGroupId": wantGroup}); code != 0 {
					t.Fatalf("repeat move code=%d", code)
				}
				if err := db.First(&current, 1).Error; err != nil {
					t.Fatal(err)
				}
				if current.Sort != wantSort {
					t.Fatalf("repeat move changed sort: %d", current.Sort)
				}
			}
		})
	}
}

func callItemMutation(t *testing.T, handler gin.HandlerFunc, input interface{}) int {
	t.Helper()
	previousLang := global.Lang
	global.Lang = &language.LangStructObj{LangContet: &iniConfig.IniConfig{Config: ini.Empty()}}
	defer func() { global.Lang = previousLang }()
	body, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("POST", "/", bytes.NewReader(body))
	context.Request.Header.Set("Content-Type", "application/json")
	context.Set("userInfo", models.User{BaseModel: models.BaseModel{ID: 1}})
	handler(context)
	var response struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response.Code
}

func TestItemIconEditMoveAppendsAndRollsBackOnFailure(t *testing.T) {
	for _, fail := range []bool{false, true} {
		t.Run(map[bool]string{false: "append", true: "rollback"}[fail], func(t *testing.T) {
			db := newPanelTestDB(t)
			previous := global.Db
			global.Db = db
			t.Cleanup(func() { global.Db = previous })
			groups := []models.ItemIconGroup{{Title: "A", UserId: 1}, {Title: "B", UserId: 1}}
			if err := db.Create(&groups).Error; err != nil {
				t.Fatal(err)
			}
			items := []models.ItemIcon{
				{Title: "App", UserId: 1, ItemIconGroupId: int(groups[0].ID), Sort: 5, Url: "https://example.com", OpenMethod: 2},
				{Title: "Last", UserId: 1, ItemIconGroupId: int(groups[1].ID), Sort: 0},
			}
			if err := db.Create(&items).Error; err != nil {
				t.Fatal(err)
			}
			if fail {
				if err := db.Exec(`CREATE TRIGGER reject_move BEFORE UPDATE ON item_icons BEGIN SELECT RAISE(ABORT, 'test write failure'); END`).Error; err != nil {
					t.Fatal(err)
				}
			}
			input := items[0]
			input.ItemIconGroupId = int(groups[1].ID)
			code := callItemMutation(t, (&ItemIcon{}).Edit, input)
			wantCode, wantGroup, wantSort := 0, int(groups[1].ID), 1
			if fail {
				wantCode, wantGroup, wantSort = 1200, int(groups[0].ID), 5
			}
			if code != wantCode {
				t.Fatalf("code=%d, want %d", code, wantCode)
			}
			var current models.ItemIcon
			if err := db.First(&current, items[0].ID).Error; err != nil {
				t.Fatal(err)
			}
			if current.ItemIconGroupId != wantGroup || current.Sort != wantSort {
				t.Fatalf("unexpected group/sort: %+v", current)
			}
			if !fail {
				input = current
				input.Title = "Renamed"
				if code := callItemMutation(t, (&ItemIcon{}).Edit, input); code != 0 {
					t.Fatalf("edit code=%d", code)
				}
				if err := db.First(&current, items[0].ID).Error; err != nil {
					t.Fatal(err)
				}
				if current.Sort != wantSort {
					t.Fatalf("same-group edit changed sort: %d", current.Sort)
				}
			}
		})
	}
}

func TestItemIconMoveWriteFailurePreservesSource(t *testing.T) {
	db := newPanelTestDB(t)
	previous := global.Db
	global.Db = db
	t.Cleanup(func() { global.Db = previous })
	groups := []models.ItemIconGroup{{Title: "A", UserId: 1}, {Title: "B", UserId: 1}}
	if err := db.Create(&groups).Error; err != nil {
		t.Fatal(err)
	}
	item := models.ItemIcon{Title: "App", UserId: 1, ItemIconGroupId: int(groups[0].ID), Sort: 5}
	if err := db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Callback().Update().Before("gorm:update").Register("test:fail-move", func(tx *gorm.DB) { tx.AddError(gorm.ErrInvalidData) }); err != nil {
		t.Fatal(err)
	}
	if code := callItemMutation(t, (&ItemIcon{}).Move, map[string]interface{}{"id": item.ID, "itemIconGroupId": groups[1].ID}); code != 1200 {
		t.Fatalf("code=%d", code)
	}
	var current models.ItemIcon
	if err := db.First(&current, item.ID).Error; err != nil {
		t.Fatal(err)
	}
	if current.ItemIconGroupId != item.ItemIconGroupId || current.Sort != item.Sort {
		t.Fatalf("failed move changed source: %+v", current)
	}
}

func TestItemIconMoveDestinationReadFailureIsDatabaseError(t *testing.T) {
	db := newPanelTestDB(t)
	previous := global.Db
	global.Db = db
	t.Cleanup(func() { global.Db = previous })
	item := models.ItemIcon{UserId: 1, ItemIconGroupId: 1, Sort: 5}
	if err := db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Migrator().DropTable(&models.ItemIconGroup{}); err != nil {
		t.Fatal(err)
	}
	if code := callItemMutation(t, (&ItemIcon{}).Move, map[string]interface{}{"id": item.ID, "itemIconGroupId": 2}); code != 1200 {
		t.Fatalf("destination read failure code=%d, want database error", code)
	}
	var current models.ItemIcon
	if err := db.First(&current, item.ID).Error; err != nil {
		t.Fatal(err)
	}
	if current.ItemIconGroupId != 1 || current.Sort != 5 {
		t.Fatal("failed destination read changed the item")
	}
}

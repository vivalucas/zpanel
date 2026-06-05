package panel

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"zpanel/global"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newPanelTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.ItemIconGroup{}, &models.ItemIcon{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestEnsureItemIconGroupsBelongToUser(t *testing.T) {
	db := newPanelTestDB(t)
	ownGroup := models.ItemIconGroup{Title: "Own", UserId: 1}
	otherGroup := models.ItemIconGroup{Title: "Other", UserId: 2}
	if err := db.Create(&ownGroup).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&otherGroup).Error; err != nil {
		t.Fatal(err)
	}

	if err := ensureItemIconGroupsBelongToUser(db, 1, []int{int(ownGroup.ID), int(ownGroup.ID)}); err != nil {
		t.Fatalf("expected own duplicate group ids to pass, got %v", err)
	}
	if err := ensureItemIconGroupsBelongToUser(db, 1, []int{int(otherGroup.ID)}); err == nil {
		t.Fatal("expected other user's group id to fail")
	}
	if err := ensureItemIconGroupsBelongToUser(db, 1, []int{0}); err == nil {
		t.Fatal("expected invalid group id to fail")
	}
}

func TestItemIconGroupDeletesKeepsAtLeastOneRealGroup(t *testing.T) {
	db := newPanelTestDB(t)
	global.Db = db
	models.Db = db

	groups := []models.ItemIconGroup{
		{Title: "A", UserId: 1},
		{Title: "B", UserId: 1},
	}
	if err := db.Create(&groups).Error; err != nil {
		t.Fatal(err)
	}

	reqBody, _ := json.Marshal(map[string][]uint{
		"ids": []uint{groups[0].ID, groups[1].ID, 999999},
	})

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("POST", "/panel/itemIconGroup/deletes", bytes.NewReader(reqBody))
	context.Request.Header.Set("Content-Type", "application/json")
	context.Set("userInfo", models.User{BaseModel: models.BaseModel{ID: 1}})

	(&ItemIconGroup{}).Deletes(context)

	var response struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Code != 1201 {
		t.Fatalf("expected code 1201, got %d body=%s", response.Code, recorder.Body.String())
	}

	var count int64
	if err := db.Model(&models.ItemIconGroup{}).Where("user_id=?", 1).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("expected groups to remain untouched, got %d", count)
	}
}

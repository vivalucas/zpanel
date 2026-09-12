package models

import (
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
	"testing"
)

func TestLegacyUsageAndOwnerScopedReplacement(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{NamingStrategy: schema.NamingStrategy{SingularTable: true}})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&User{}, &ItemIcon{}, &UserConfig{}, &ModuleConfig{}, &SystemSetting{}, &FileReference{}); err != nil {
		t.Fatal(err)
	}
	file := File{BaseModel: BaseModel{ID: 10}, RelativePath: "public/gallery/original.png"}
	replacement := File{BaseModel: BaseModel{ID: 11}, RelativePath: "public/gallery/new.png"}
	rows := []ItemIcon{
		{UserId: 1, Title: "Own", IconJson: `{"src":"/uploads/public/gallery/original.png"}`},
		{UserId: 2, Title: "Private title", IconJson: `{"src":"\/uploads\/public\/gallery\/original.png"}`},
	}
	db.Create(&rows)
	db.Create(&UserConfig{UserId: 1, PanelJson: `{"backgroundImageSrc":"/uploads/public/gallery/original.png"}`})
	usages, err := FindFileUsage(db, file)
	if err != nil {
		t.Fatal(err)
	}
	if len(usages) != 3 {
		t.Fatalf("missed legacy references: %#v", usages)
	}
	if err := db.Transaction(func(tx *gorm.DB) error { return ReplaceFileUsage(tx, file, replacement, 1, false) }); err != nil {
		t.Fatal(err)
	}
	usages, err = FindFileUsage(db, file)
	if err != nil || len(usages) != 1 || usages[0].OwnerID != 2 {
		t.Fatalf("changed another account or retained own refs: %#v %v", usages, err)
	}
	usages, err = FindFileUsage(db, replacement)
	if err != nil || len(usages) != 2 {
		t.Fatalf("replacement refs missing: %#v %v", usages, err)
	}
}

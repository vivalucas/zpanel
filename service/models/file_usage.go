package models

import (
	"encoding/json"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type FileUsage struct {
	Kind    string `json:"kind"`
	ID      string `json:"id"`
	OwnerID uint   `json:"-"`
	Title   string `json:"title"`
}
type usageSource struct {
	table, key, owner, title, kind string
	columns, ids                   []string
	softDelete                     bool
}

var usageSources = []usageSource{
	{"item_icon", "id", "user_id", "title", "icon", []string{"icon_json", "icon_value"}, []string{"file_id"}, true},
	{"user_config", "user_id", "user_id", "", "wallpaper", []string{"panel_json", "search_engine_json"}, []string{"wallpaper_file_id"}, false},
	{"user", "id", "id", "name", "avatar", []string{"head_image"}, []string{"avatar_file_id"}, true},
	{"module_config", "id", "user_id", "name", "module", []string{"value_json"}, nil, true},
	{"system_setting", "id", "", "config_name", "site", []string{"config_value"}, nil, false},
}

func valueString(value interface{}) string {
	switch v := value.(type) {
	case nil:
		return ""
	case []byte:
		return string(v)
	default:
		return fmt.Sprint(v)
	}
}

// FindFileUsage scans existing URL-based data, so protection also covers files
// created before file references were introduced. It is used on demand, not per thumbnail.
func FindFileUsage(db *gorm.DB, file File) ([]FileUsage, error) {
	return walkFileUsage(db, file, nil, 0, false)
}

// ReplaceFileUsage updates only the caller's references; shared users retain control of theirs.
func ReplaceFileUsage(db *gorm.DB, file, replacement File, userID uint, admin bool) error {
	_, err := walkFileUsage(db, file, &replacement, userID, admin)
	return err
}

func walkFileUsage(db *gorm.DB, file File, replacement *File, userID uint, admin bool) ([]FileUsage, error) {
	usages := []FileUsage{}
	sourcePath := "/uploads/" + strings.TrimPrefix(file.RelativePath, "/")
	for _, source := range usageSources {
		columns := append([]string{source.key}, source.columns...)
		columns = append(columns, source.ids...)
		if source.owner != "" && source.owner != source.key {
			columns = append(columns, source.owner)
		}
		if source.title != "" {
			columns = append(columns, source.title)
		}
		rows := []map[string]interface{}{}
		query := db.Table(source.table).Select(columns)
		if source.softDelete {
			query = query.Where("deleted_at IS NULL")
		}
		if err := query.Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			updates := map[string]interface{}{}
			matches := false
			for _, column := range source.columns {
				text := valueString(row[column])
				// Decode JSON escapes before looking for a path (including escaped slashes).
				var decoded interface{}
				isJSON := json.Unmarshal([]byte(text), &decoded) == nil
				if isJSON {
					normalized, err := json.Marshal(decoded)
					if err != nil {
						return nil, err
					}
					text = string(normalized)
				}
				if strings.Contains(text, sourcePath) {
					matches = true
					if replacement != nil {
						updates[column] = strings.ReplaceAll(text, sourcePath, "/uploads/"+strings.TrimPrefix(replacement.RelativePath, "/"))
					}
				}
			}
			for _, column := range source.ids {
				if valueString(row[column]) == fmt.Sprint(file.ID) {
					matches = true
					if replacement != nil {
						updates[column] = replacement.ID
					}
				}
			}
			if !matches {
				continue
			}
			var owner uint
			_, _ = fmt.Sscan(valueString(row[source.owner]), &owner)
			usages = append(usages, FileUsage{Kind: source.kind, ID: valueString(row[source.key]), OwnerID: owner, Title: valueString(row[source.title])})
			if replacement != nil && (owner == userID || (source.owner == "" && admin)) {
				if err := db.Table(source.table).Where(source.key+"=?", row[source.key]).Updates(updates).Error; err != nil {
					return nil, err
				}
			}
		}
	}
	var references []FileReference
	if err := db.Where("file_id=?", file.ID).Find(&references).Error; err != nil {
		return nil, err
	}
	for _, ref := range references {
		usages = append(usages, FileUsage{Kind: "reference", ID: fmt.Sprint(ref.ID), OwnerID: ref.OwnerID})
	}
	if replacement != nil {
		if err := db.Model(&FileReference{}).Where("file_id=? AND owner_id=?", file.ID, userID).Update("file_id", replacement.ID).Error; err != nil {
			return nil, err
		}
	}
	return usages, nil
}

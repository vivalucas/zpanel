package models

type UserConfig struct {
	UserId          uint   `gorm:"primaryKey" json:"userId"`
	SchemaVersion   int    `gorm:"not null;default:1" json:"schemaVersion"`
	NetworkMode     string `gorm:"type:varchar(32);not null;default:wan" json:"networkMode"`
	Theme           string `gorm:"type:varchar(32);not null;default:auto" json:"theme"`
	Language        string `gorm:"type:varchar(32);not null;default:zh-CN" json:"language"`
	WallpaperFileID *uint  `gorm:"index" json:"wallpaperFileId"`

	// 纯前端数据，面板样式数据
	PanelJson string                 `json:"-"`
	Panel     map[string]interface{} `gorm:"-" json:"panel"`

	// 搜索引擎
	SearchEngineJson string                 `json:"-"`
	SearchEngine     map[string]interface{} `gorm:"-" json:"searchEngine"`
}

package models

import (
	"encoding/json"

	"gorm.io/gorm"
)

// 系统设置
type SystemSetting struct {
	ID            uint   `gorm:"primaryKey"`
	ConfigName    string `gorm:"type:varchar(128);uniqueIndex;not null"`
	ConfigValue   string `gorm:"type:text"`
	ValueType     string `gorm:"type:varchar(32);not null;default:json"`
	SchemaVersion int    `gorm:"not null;default:1"`
	IsPublic      bool   `gorm:"not null;default:false"`
}

func (m *SystemSetting) Get(configName string) (result string, err error) {
	var res SystemSetting
	if err := Db.Model(m).Select("ConfigValue").First(&res, "config_name=?", configName).Error; err != nil {
		return result, err
	}
	result = res.ConfigValue
	return result, nil
}

func (m *SystemSetting) GetValueByInterface(configName string, structValue interface{}) error {
	result, err := m.Get(configName)
	if err != nil {
		return err
	}
	err = json.Unmarshal([]byte(result), structValue)
	if err != nil {
		return err
	}
	return nil
}

// 暂时仅支持结构体和字符串
func (m *SystemSetting) Set(configName string, configValue interface{}) error {
	return m.SetWithDB(Db, configName, configValue)
}

func (m *SystemSetting) SetWithDB(db *gorm.DB, configName string, configValue interface{}) error {
	findRes := SystemSetting{}
	result := db.Model(&SystemSetting{}).First(&findRes, "config_name=?", configName)
	if err := result.Error; err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	value := ""
	if s, ok := configValue.(string); !ok {
		if jsonStr, err := json.Marshal(configValue); err != nil {
			return err
		} else {
			value = string(jsonStr)
		}
	} else {
		value = s
	}

	if result.RowsAffected == 0 {
		// 添加
		if err := db.Create(&SystemSetting{ConfigName: configName, ConfigValue: value, ValueType: "json", SchemaVersion: 1}).Error; err != nil {
			return err
		}

	} else {
		// 修改
		if err := db.Model(&SystemSetting{}).Where("id=?", findRes.ID).Update("config_value", value).Error; err != nil {
			return err
		}
	}
	return nil
}

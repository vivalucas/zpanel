package systemSetting

import (
	"encoding/json"
	"errors"
	"zpanel/lib/cache"
	"zpanel/models"

	"gorm.io/gorm"
)

const (
	SYSTEM_APPLICATION    = "system_application"
	SYSTEM_EMAIL          = "system_email"
	DISCLAIMER            = "disclaimer"            // 免责声明 储存类型：字符串
	WEB_ABOUT_DESCRIPTION = "web_about_description" // 关于的描述信息
	PANEL_PUBLIC_USER_ID  = "panel_public_user_id"  // 公开访问模式用户id *uint|null
	SITE_SETTING          = "site_setting"          // 站点展示配置
)

type SystemSettingCache struct {
	Cache cache.Cacher[interface{}]
}

type Email struct {
	Host     string `json:"host" binding:"required"`
	Port     int    `json:"port" binding:"required"`
	Mail     string `json:"mail" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type Register struct {
	EmailSuffix  string `json:"emailSuffix"`  // 注册邮箱后缀
	OpenRegister bool   `json:"openRegister"` // 开放注册
}

type Login struct {
	LoginCaptcha bool `json:"loginCaptcha"` // 登录验证码
}

type ApplicationSetting struct {
	Register
	Login
	WebSiteUrl string `json:"webSiteUrl"` // 站点地址
}

type SiteSetting struct {
	SiteTitle     string `json:"siteTitle"`
	SiteIcon      string `json:"siteIcon"`
	LoginTitle    string `json:"loginTitle"`
	LoginSubtitle string `json:"loginSubtitle"`
	LoginFooter   string `json:"loginFooter"`
	CustomCss     string `json:"customCss"`
	CustomJs      string `json:"customJs"`
}

func DefaultSiteSetting() SiteSetting {
	return SiteSetting{
		SiteTitle:   "ZPanel",
		SiteIcon:    "/favicon.svg",
		LoginTitle:  "ZPanel",
		LoginFooter: `Powered By <a href="https://github.com/vivalucas/zpanel" target="_blank" rel="noopener noreferrer">ZPanel</a>`,
	}
}

var (
	ErrorNoExists = errors.New("no exists")
)

// 系统配置启用缓存功能
func (s *SystemSettingCache) GetValueString(configName string) (result string, err error) {
	if v, ok := s.cachedValue(configName); ok {
		if v1, ok1 := v.(string); ok1 {
			// fmt.Println("读取缓存")
			return v1, nil
		}
	}

	mSetting := models.SystemSetting{}
	result, err = mSetting.Get(configName)
	if err == gorm.ErrRecordNotFound {
		err = ErrorNoExists
	}
	// 查询出来，缓存起来
	if err == nil && !securitySetting(configName) {
		s.Cache.SetDefault(configName, result)
	}
	return
}

// value 需为指针
func (s *SystemSettingCache) GetValueByInterface(configName string, value interface{}) error {
	if v, ok := s.cachedValue(configName); ok {
		// fmt.Println("缓存")
		if s, sok := v.(string); sok {
			if err := json.Unmarshal([]byte(s), value); err != nil {
				return err
			}
			return nil
		}
	}

	mSetting := models.SystemSetting{}
	result, err := mSetting.Get(configName)
	if err == gorm.ErrRecordNotFound {
		err = ErrorNoExists
		return err
	}
	if err != nil {
		return err
	}
	err = DecodeValue(configName, result, value)
	if err != nil {
		return err
	}
	if !securitySetting(configName) {
		s.Cache.SetDefault(configName, result)
	}
	return nil
}

func (s *SystemSettingCache) Set(configName string, configValue interface{}) error {
	mSetting := models.SystemSetting{}
	if err := mSetting.Set(configName, configValue); err != nil {
		return err
	}
	if !securitySetting(configName) {
		s.Cache.Delete(configName)
	}
	return nil
}

func DecodeValue(name, raw string, value interface{}) error {
	if name == SYSTEM_APPLICATION || name == SITE_SETTING {
		var fields map[string]interface{}
		if err := json.Unmarshal([]byte(raw), &fields); err != nil {
			return err
		}
		if fields == nil {
			return errors.New("settings must be an object")
		}
		if name == SYSTEM_APPLICATION {
			for _, key := range []string{"loginCaptcha", "openRegister"} {
				if v, exists := fields[key]; exists {
					if _, ok := v.(bool); !ok {
						return errors.New("invalid application setting: " + key)
					}
				}
			}
		}
	}
	return json.Unmarshal([]byte(raw), value)
}

// Defaults are only valid when the record is absent; reads never rewrite failed settings.
func (s *SystemSettingCache) GetValueOrDefault(configName string, value interface{}) error {
	err := s.GetValueByInterface(configName, value)
	if errors.Is(err, ErrorNoExists) {
		return nil
	}
	return err
}

// Authentication/privacy settings must not depend on successful Redis invalidation.
func securitySetting(name string) bool {
	return name == SYSTEM_APPLICATION || name == SITE_SETTING || name == PANEL_PUBLIC_USER_ID
}

func (s *SystemSettingCache) cachedValue(name string) (interface{}, bool) {
	if securitySetting(name) {
		return nil, false
	}
	return s.Cache.Get(name)
}

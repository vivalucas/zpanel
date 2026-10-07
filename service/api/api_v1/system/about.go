package system

import (
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/global"
	"zpanel/lib/cmn"
	"zpanel/lib/cmn/systemSetting"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
)

type About struct {
}

func (a *About) Get(c *gin.Context) {
	version := cmn.GetSysVersionInfo()
	apiReturn.SuccessData(c, gin.H{
		"versionName": version.Version,
		"versionCode": version.Version_code,
	})
}

func (a *About) GetSiteSetting(c *gin.Context) {
	siteSetting := systemSetting.DefaultSiteSetting()
	if err := global.SystemSetting.GetValueOrDefault(systemSetting.SITE_SETTING, &siteSetting); err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	appSetting := systemSetting.ApplicationSetting{}
	if err := global.SystemSetting.GetValueOrDefault(systemSetting.SYSTEM_APPLICATION, &appSetting); err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	apiReturn.SuccessData(c, gin.H{
		"siteSetting":  siteSetting,
		"loginCaptcha": appSetting.LoginCaptcha,
	})
}

func (a *About) SetSiteSetting(c *gin.Context) {
	type Req struct {
		systemSetting.SiteSetting
		LoginCaptcha bool `json:"loginCaptcha"`
	}

	req := Req{}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	siteSetting := systemSetting.SiteSetting{
		SiteTitle:     req.SiteTitle,
		SiteIcon:      req.SiteIcon,
		LoginTitle:    req.LoginTitle,
		LoginSubtitle: req.LoginSubtitle,
		LoginFooter:   req.LoginFooter,
		CustomCss:     req.CustomCss,
		CustomJs:      req.CustomJs,
	}
	if siteSetting.SiteTitle == "" {
		siteSetting.SiteTitle = "ZPanel"
	}
	if siteSetting.LoginTitle == "" {
		siteSetting.LoginTitle = siteSetting.SiteTitle
	}

	err := global.Db.Transaction(func(tx *gorm.DB) error {
		appSetting := systemSetting.ApplicationSetting{}
		stored := models.SystemSetting{}
		if err := tx.First(&stored, "config_name=?", systemSetting.SYSTEM_APPLICATION).Error; err != nil && err != gorm.ErrRecordNotFound {
			return err
		} else if err == nil {
			if err := systemSetting.DecodeValue(systemSetting.SYSTEM_APPLICATION, stored.ConfigValue, &appSetting); err != nil {
				return err
			}
		}
		appSetting.LoginCaptcha = req.LoginCaptcha
		if err := stored.SetWithDB(tx, systemSetting.SITE_SETTING, siteSetting); err != nil {
			return err
		}
		return stored.SetWithDB(tx, systemSetting.SYSTEM_APPLICATION, appSetting)
	})
	if err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	apiReturn.Success(c)
}

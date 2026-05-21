package openness

import (
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/global"
	"zpanel/lib/cmn/systemSetting"

	"github.com/gin-gonic/gin"
)

type Openness struct {
}

func (a *Openness) LoginConfig(c *gin.Context) {
	cfg := systemSetting.ApplicationSetting{}
	if err := global.SystemSetting.GetValueByInterface(systemSetting.SYSTEM_APPLICATION, &cfg); err != nil {
		cfg = systemSetting.ApplicationSetting{}
		_ = global.SystemSetting.Set(systemSetting.SYSTEM_APPLICATION, cfg)
	}
	siteSetting := systemSetting.DefaultSiteSetting()
	if err := global.SystemSetting.GetValueByInterface(systemSetting.SITE_SETTING, &siteSetting); err != nil {
		_ = global.SystemSetting.Set(systemSetting.SITE_SETTING, siteSetting)
	}
	apiReturn.SuccessData(c, gin.H{
		"loginCaptcha": cfg.LoginCaptcha,
		"register":     cfg.Register,
		"siteSetting":  siteSetting,
	})
}

func (a *Openness) GetDisclaimer(c *gin.Context) {
	if content, err := global.SystemSetting.GetValueString(systemSetting.DISCLAIMER); err != nil {
		global.SystemSetting.Set(systemSetting.DISCLAIMER, "")
		apiReturn.SuccessData(c, "")
		return
	} else {
		apiReturn.SuccessData(c, content)
	}
}

func (a *Openness) GetAboutDescription(c *gin.Context) {
	if content, err := global.SystemSetting.GetValueString(systemSetting.WEB_ABOUT_DESCRIPTION); err != nil {
		global.SystemSetting.Set(systemSetting.WEB_ABOUT_DESCRIPTION, "")
		apiReturn.SuccessData(c, "")
		return
	} else {
		apiReturn.SuccessData(c, content)
	}
}

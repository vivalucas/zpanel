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
	if err := global.SystemSetting.GetValueOrDefault(systemSetting.SYSTEM_APPLICATION, &cfg); err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	siteSetting := systemSetting.DefaultSiteSetting()
	if err := global.SystemSetting.GetValueOrDefault(systemSetting.SITE_SETTING, &siteSetting); err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	apiReturn.SuccessData(c, gin.H{
		"loginCaptcha": cfg.LoginCaptcha,
		"register":     cfg.Register,
		"siteSetting":  siteSetting,
	})
}

func (a *Openness) GetDisclaimer(c *gin.Context) {
	if content, err := global.SystemSetting.GetValueString(systemSetting.DISCLAIMER); err != nil {
		if err == systemSetting.ErrorNoExists {
			apiReturn.SuccessData(c, "")
		} else {
			apiReturn.ErrorDatabase(c, err.Error())
		}
		return
	} else {
		apiReturn.SuccessData(c, content)
	}
}

func (a *Openness) GetAboutDescription(c *gin.Context) {
	if content, err := global.SystemSetting.GetValueString(systemSetting.WEB_ABOUT_DESCRIPTION); err != nil {
		if err == systemSetting.ErrorNoExists {
			apiReturn.SuccessData(c, "")
		} else {
			apiReturn.ErrorDatabase(c, err.Error())
		}
		return
	} else {
		apiReturn.SuccessData(c, content)
	}
}

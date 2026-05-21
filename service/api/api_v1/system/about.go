package system

import (
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/global"
	"zpanel/lib/cmn"
	"zpanel/lib/cmn/systemSetting"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
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
	if err := global.SystemSetting.GetValueByInterface(systemSetting.SITE_SETTING, &siteSetting); err != nil {
		if err := global.SystemSetting.Set(systemSetting.SITE_SETTING, siteSetting); err != nil {
			apiReturn.ErrorDatabase(c, err.Error())
			return
		}
	}

	appSetting := systemSetting.ApplicationSetting{}
	_ = global.SystemSetting.GetValueByInterface(systemSetting.SYSTEM_APPLICATION, &appSetting)

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

	if err := global.SystemSetting.Set(systemSetting.SITE_SETTING, siteSetting); err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	appSetting := systemSetting.ApplicationSetting{}
	_ = global.SystemSetting.GetValueByInterface(systemSetting.SYSTEM_APPLICATION, &appSetting)
	appSetting.LoginCaptcha = req.LoginCaptcha
	if err := global.SystemSetting.Set(systemSetting.SYSTEM_APPLICATION, appSetting); err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	apiReturn.Success(c)
}

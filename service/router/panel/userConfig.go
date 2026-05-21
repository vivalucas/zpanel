package panel

import (
	"zpanel/api/api_v1"
	"zpanel/api/api_v1/middleware"

	"github.com/gin-gonic/gin"
)

func InitUserConfig(router *gin.RouterGroup) {
	api := api_v1.ApiGroupApp.ApiPanel.UserConfig
	r := router.Group("", middleware.LoginInterceptor)
	{
		r.POST("/panel/userConfig/set", api.Set)
	}

	// 公开模式
	rPublic := router.Group("", middleware.PublicModeInterceptor)
	{
		rPublic.POST("/panel/userConfig/get", api.Get)
	}
}

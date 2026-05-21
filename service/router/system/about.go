package system

import (
	"zpanel/api/api_v1"
	"zpanel/api/api_v1/middleware"

	"github.com/gin-gonic/gin"
)

func InitAbout(router *gin.RouterGroup) {
	about := api_v1.ApiGroupApp.ApiSystem.About
	{
		router.POST("about", about.Get)
		router.POST("system/siteSetting/get", middleware.LoginInterceptor, about.GetSiteSetting)
		router.POST("system/siteSetting/set", middleware.LoginInterceptor, middleware.AdminInterceptor, about.SetSiteSetting)
	}
}

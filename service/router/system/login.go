package system

import (
	"zpanel/api/api_v1"
	"zpanel/api/api_v1/middleware"

	"github.com/gin-gonic/gin"
)

func InitLogin(router *gin.RouterGroup) {
	loginApi := api_v1.ApiGroupApp.ApiSystem.LoginApi

	router.POST("/login", middleware.LoginRateLimit, loginApi.Login)
	router.POST("/logout", middleware.LoginInterceptor, loginApi.Logout)
	router.GET("/captcha/getImageByCaptchaId/:id/:width/:height", loginApi.CaptchaImage)

}

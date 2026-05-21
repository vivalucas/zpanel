package router

import (
	"net/http"

	"zpanel/api/api_v1/middleware"
	"zpanel/global"
	"zpanel/lib/storage"
	// "zpanel/router/admin"
	"zpanel/router/openness"
	"zpanel/router/panel"
	"zpanel/router/system"

	"github.com/gin-gonic/gin"
)

func NewRouter() *gin.Engine {
	router := gin.Default()
	router.Use(middleware.SecurityHeaders)
	rootRouter := router.Group("/")
	routerGroup := rootRouter.Group("api")

	routerGroup.GET("healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
		})
	})

	// 接口
	system.Init(routerGroup)
	panel.Init(routerGroup)
	openness.Init(routerGroup)

	// WEB文件服务
	{
		webPath := "./web"
		router.StaticFile("/", webPath+"/index.html")
		router.Static("/assets", webPath+"/assets")
		router.Static("/custom", webPath+"/custom")
		router.StaticFile("/favicon.ico", webPath+"/favicon.ico")
		router.StaticFile("/favicon.svg", webPath+"/favicon.svg")
	}

	// 上传的文件。URL 固定为 /uploads，物理目录由 storage.uploads_path 控制。
	router.Static("/uploads", storage.UploadsPath())

	return router
}

// 初始化总路由
func InitRouters(addr string) error {
	router := NewRouter()
	global.Logger.Info("ZPanel is Started.  Listening and serving HTTP on ", addr)
	return router.Run(addr)
}

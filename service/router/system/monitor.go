package system

import (
	"zpanel/api/api_v1"
	"zpanel/api/api_v1/middleware"

	"github.com/gin-gonic/gin"
)

func InitMonitorRouter(router *gin.RouterGroup) {
	api := api_v1.ApiGroupApp.ApiSystem.MonitorApi
	dockerApi := api_v1.ApiGroupApp.ApiSystem.DockerApi
	r := router.Group("", middleware.LoginInterceptor)
	r.POST("/system/monitor/getDiskMountpoints", api.GetDiskMountpoints)
	r.POST("/system/docker/containers", middleware.AdminInterceptor, dockerApi.Containers)
	r.POST("/system/docker/stats", middleware.AdminInterceptor, dockerApi.Stats)
	r.POST("/system/docker/action", middleware.AdminInterceptor, dockerApi.Action)
	r.POST("/system/docker/logs", middleware.AdminInterceptor, dockerApi.Logs)

	// 公开模式
	rPublic := router.Group("", middleware.PublicModeInterceptor)
	{
		rPublic.POST("/system/monitor/getAll", api.GetAll)
		rPublic.POST("/system/monitor/getCpuState", api.GetCpuState)
		rPublic.POST("/system/monitor/getDiskStateByPath", api.GetDiskStateByPath)
		rPublic.POST("/system/monitor/getMemonyState", api.GetMemonyState)
	}
}

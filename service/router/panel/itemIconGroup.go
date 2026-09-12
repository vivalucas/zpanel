package panel

import (
	"zpanel/api/api_v1"
	"zpanel/api/api_v1/middleware"

	"github.com/gin-gonic/gin"
)

func InitItemIconGroup(router *gin.RouterGroup) {
	itemIconGroup := api_v1.ApiGroupApp.ApiPanel.ItemIconGroup
	r := router.Group("", middleware.LoginInterceptor)
	{
		r.POST("/panel/itemIconGroup/edit", middleware.ResourceMutation, itemIconGroup.Edit)
		r.POST("/panel/itemIconGroup/deletes", middleware.ResourceMutation, itemIconGroup.Deletes)
		r.POST("/panel/itemIconGroup/saveSort", itemIconGroup.SaveSort)
	}

	// 公开模式
	rPublic := router.Group("", middleware.PublicModeInterceptor)
	{
		rPublic.POST("/panel/itemIconGroup/getList", itemIconGroup.GetList)
	}
}

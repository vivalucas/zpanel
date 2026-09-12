package panel

import (
	"zpanel/api/api_v1"
	"zpanel/api/api_v1/middleware"

	"github.com/gin-gonic/gin"
)

func InitItemIcon(router *gin.RouterGroup) {
	itemIcon := api_v1.ApiGroupApp.ApiPanel.ItemIcon
	r := router.Group("", middleware.LoginInterceptor)
	{
		r.POST("/panel/itemIcon/edit", middleware.ResourceMutation, itemIcon.Edit)
		r.POST("/panel/itemIcon/deletes", middleware.ResourceMutation, itemIcon.Deletes)
		r.POST("/panel/itemIcon/saveSort", itemIcon.SaveSort)
		r.POST("/panel/itemIcon/addMultiple", middleware.ResourceMutation, itemIcon.AddMultiple)
		r.POST("/panel/itemIcon/getSiteFavicon", itemIcon.GetSiteFavicon)
	}

	// 公开模式
	rPublic := router.Group("", middleware.PublicModeInterceptor)
	{
		rPublic.POST("/panel/itemIcon/getListByGroupId", itemIcon.GetListByGroupId)
	}
}

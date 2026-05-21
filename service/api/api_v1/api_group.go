package api_v1

import (
	"zpanel/api/api_v1/openness"
	"zpanel/api/api_v1/panel"
	"zpanel/api/api_v1/system"
)

type ApiGroup struct {
	ApiSystem system.ApiSystem // 系统功能api
	ApiOpen   openness.ApiOpenness
	ApiPanel  panel.ApiPanel
}

var ApiGroupApp = new(ApiGroup)

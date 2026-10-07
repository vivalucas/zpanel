package middleware

import (
	"encoding/json"
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/api/api_v1/common/base"
	"zpanel/global"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func MonitorAccess(c *gin.Context) {
	if base.GetCurrentVisitMode(c) != base.VISIT_MODE_PUBLIC {
		return
	}
	user, _ := base.GetCurrentUserInfo(c)
	cfg := models.UserConfig{}
	if err := global.Db.First(&cfg, "user_id=?", user.ID).Error; err != nil && err != gorm.ErrRecordNotFound {
		apiReturn.ErrorDatabase(c, err.Error())
		c.Abort()
		return
	}
	var panel struct {
		Show   bool `json:"systemMonitorShow"`
		Public bool `json:"systemMonitorPublicVisitModeShow"`
	}
	if json.Unmarshal([]byte(cfg.PanelJson), &panel) != nil || !panel.Show || !panel.Public {
		apiReturn.ErrorNoAccess(c)
		c.Abort()
	}
}

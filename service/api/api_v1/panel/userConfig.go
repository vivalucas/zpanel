package panel

import (
	"encoding/json"
	"gorm.io/gorm/clause"
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/api/api_v1/common/base"
	"zpanel/global"
	"zpanel/lib/panelconfig"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
)

type UserConfig struct {
}

func (a *UserConfig) Get(c *gin.Context) {
	userInfo, _ := base.GetCurrentUserInfo(c)
	cfg := models.UserConfig{}
	if err := global.Db.First(&cfg, "user_id=?", userInfo.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			apiReturn.ErrorDataNotFound(c)
			return
		} else {
			apiReturn.ErrorDatabase(c, err.Error())
			return
		}
	}

	// 处理字段
	if err := json.Unmarshal([]byte(cfg.PanelJson), &cfg.Panel); err != nil || cfg.Panel == nil {
		cfg.Panel = map[string]interface{}{}
		cfg.PanelWarnings = []string{"panel"}
	} else {
		cfg.Panel, cfg.PanelWarnings = panelconfig.Sanitize(cfg.Panel)
	}
	if err := json.Unmarshal([]byte(cfg.SearchEngineJson), &cfg.SearchEngine); err != nil {
		cfg.SearchEngine = nil
	}
	apiReturn.SuccessData(c, cfg)

}

func (a *UserConfig) Set(c *gin.Context) {
	userInfo, _ := base.GetCurrentUserInfo(c)
	input := struct {
		Panel        map[string]interface{} `json:"panel"`
		SearchEngine map[string]interface{} `json:"searchEngine"`
	}{}

	if err := c.ShouldBindBodyWith(&input, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	if input.Panel == nil {
		apiReturn.ErrorParamFomat(c, "panel is required")
		return
	}
	if err := panelconfig.Validate(input.Panel); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	req := models.UserConfig{UserId: userInfo.ID, Panel: input.Panel, SearchEngine: input.SearchEngine}

	// 处理字段
	if jb, err := json.Marshal(req.Panel); err != nil {
		req.PanelJson = "{}"
	} else {
		req.PanelJson = string(jb)
	}

	if jb, err := json.Marshal(req.SearchEngine); err != nil {
		req.SearchEngineJson = "{}"
	} else {
		req.SearchEngineJson = string(jb)
	}

	columns := []string{"panel_json"}
	if input.SearchEngine != nil {
		columns = append(columns, "search_engine_json")
	}
	if err := global.Db.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "user_id"}}, DoUpdates: clause.AssignmentColumns(columns)}).Create(&req).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	apiReturn.Success(c)
}

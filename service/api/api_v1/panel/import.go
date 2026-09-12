package panel

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/api/api_v1/common/base"
	"zpanel/global"
	"zpanel/lib/navigation"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type importGroup struct {
	Title    string            `json:"title"`
	Sort     int               `json:"sort"`
	Children []models.ItemIcon `json:"children"`
}
type importRequest struct {
	RequestID string                 `json:"requestId"`
	Mode      string                 `json:"mode"`
	Icons     *[]importGroup         `json:"icons"`
	Panel     map[string]interface{} `json:"panel"`
}

func importConfig(db *gorm.DB, userID uint, req importRequest) error {
	if len(req.RequestID) < 16 || len(req.RequestID) > 64 {
		return fmt.Errorf("invalid import request ID")
	}
	if req.Mode != "append" && req.Mode != "replace" {
		return fmt.Errorf("invalid import mode")
	}
	if req.Icons == nil && req.Panel == nil {
		return fmt.Errorf("no data selected")
	}
	if req.Icons != nil {
		if len(*req.Icons) > 500 || (req.Mode == "replace" && len(*req.Icons) == 0) {
			return fmt.Errorf("invalid group count")
		}
		count := 0
		for _, group := range *req.Icons {
			if group.Title == "" || len(group.Title) > 200 {
				return fmt.Errorf("invalid group title")
			}
			count += len(group.Children)
			for _, item := range group.Children {
				if item.Title == "" {
					return fmt.Errorf("item title is required")
				}
				if err := navigation.Validate(item.Url); err != nil {
					return err
				}
				if err := navigation.Validate(item.LanUrl); err != nil {
					return err
				}
			}
		}
		if count > 10000 {
			return fmt.Errorf("too many items")
		}
	}
	payload, err := json.Marshal(req)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(payload)
	hash := hex.EncodeToString(sum[:])
	return db.Transaction(func(tx *gorm.DB) error {
		receipt := models.ImportReceipt{UserID: userID, RequestID: req.RequestID, PayloadHash: hash}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&receipt)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			var previous models.ImportReceipt
			if err := tx.First(&previous, "user_id=? AND request_id=?", userID, req.RequestID).Error; err != nil {
				return err
			}
			if previous.PayloadHash != hash {
				return fmt.Errorf("import request changed; select the file again")
			}
			return nil
		}
		if req.Icons != nil {
			if req.Mode == "replace" {
				if err := tx.Where("user_id=?", userID).Delete(&models.ItemIcon{}).Error; err != nil {
					return err
				}
				if err := tx.Where("user_id=?", userID).Delete(&models.ItemIconGroup{}).Error; err != nil {
					return err
				}
			}
			for _, group := range *req.Icons {
				created := models.ItemIconGroup{Title: group.Title, Sort: group.Sort, UserId: userID}
				if err := tx.Create(&created).Error; err != nil {
					return err
				}
				for _, input := range group.Children {
					icon, err := json.Marshal(input.Icon)
					if err != nil {
						return err
					}
					// Do not persist client-supplied IDs, owners, or GORM associations.
					item := models.ItemIcon{Title: input.Title, Sort: input.Sort, IconJson: string(icon), Url: input.Url, LanUrl: input.LanUrl, Description: input.Description, OpenMethod: input.OpenMethod, ItemIconGroupId: int(created.ID), UserId: userID}
					if err := tx.Omit(clause.Associations).Create(&item).Error; err != nil {
						return err
					}
				}
			}
		}
		if req.Panel != nil {
			cfg := models.UserConfig{}
			err := tx.First(&cfg, "user_id=?", userID).Error
			if err != nil && err != gorm.ErrRecordNotFound {
				return err
			}
			merged := map[string]interface{}{}
			if cfg.PanelJson != "" {
				if err := json.Unmarshal([]byte(cfg.PanelJson), &merged); err != nil {
					return err
				}
			}
			if merged == nil {
				merged = map[string]interface{}{}
			}
			for key, value := range req.Panel {
				merged[key] = value
			}
			panelJSON, err := json.Marshal(merged)
			if err != nil {
				return err
			}
			cfg.UserId, cfg.PanelJson = userID, string(panelJSON)
			if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "user_id"}}, DoUpdates: clause.AssignmentColumns([]string{"panel_json"})}).Create(&cfg).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (a *UserConfig) Import(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 5*1024*1024)
	req := importRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		apiReturn.Error(c, "invalid import file")
		return
	}
	user, _ := base.GetCurrentUserInfo(c)
	if err := importConfig(global.Db, user.ID, req); err != nil {
		apiReturn.Error(c, err.Error())
		return
	}
	apiReturn.Success(c)
}

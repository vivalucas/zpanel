package panel

import (
	"encoding/json"
	"fmt"
	"zpanel/api/api_v1/common/apiData/commonApiStructs"
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/api/api_v1/common/base"
	"zpanel/global"
	"zpanel/models"
	"zpanel/models/datatype"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"strings"
)

type ItemIconGroup struct {
}

func (a *ItemIconGroup) Edit(c *gin.Context) {
	userInfo, _ := base.GetCurrentUserInfo(c)
	input := struct {
		ID          uint   `json:"id"`
		Icon        string `json:"icon"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Sort        int    `json:"sort"`
	}{}

	if err := c.ShouldBindBodyWith(&input, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	if err := models.ValidateNavigationTitle(input.Title); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	req := models.ItemIconGroup{BaseModel: models.BaseModel{ID: input.ID}, Icon: input.Icon, Title: strings.TrimSpace(input.Title), Description: input.Description, Sort: input.Sort, UserId: userInfo.ID}

	if req.ID != 0 {
		// 修改
		updateField := []string{"Icon", "Title", "Description", "UserId"}
		if req.Sort != 0 {
			updateField = append(updateField, "Sort")
		}
		var count int64
		if err := global.Db.Model(&models.ItemIconGroup{}).Where("id=? AND user_id=?", req.ID, userInfo.ID).Count(&count).Error; err != nil {
			apiReturn.ErrorDatabase(c, err.Error())
			return
		}
		if count == 0 {
			apiReturn.ErrorNoAccess(c)
			return
		}
		result := global.Db.Model(&models.ItemIconGroup{}).
			Select(updateField).
			Where("id=? AND user_id=?", req.ID, userInfo.ID).Updates(&req)
		if result.Error != nil {
			apiReturn.ErrorDatabase(c, result.Error.Error())
			return
		}
	} else {
		// 创建
		if err := global.Db.Omit(clause.Associations).Create(&req).Error; err != nil {
			apiReturn.ErrorDatabase(c, err.Error())
			return
		}
	}

	apiReturn.SuccessData(c, req)
}

func readGroups(tx *gorm.DB, userID uint) ([]models.ItemIconGroup, error) {
	groups := []models.ItemIconGroup{}
	if err := tx.Order("sort, created_at, id").Where("user_id=?", userID).Find(&groups).Error; err != nil {
		return nil, err
	}
	if len(groups) == 0 {
		group := models.ItemIconGroup{Title: "APP", UserId: userID, Icon: "material-symbols:ad-group-outline"}
		if err := tx.Omit(clause.Associations).Create(&group).Error; err != nil {
			return nil, err
		}
		if err := tx.Model(&models.ItemIcon{}).Where("user_id=?", userID).Update("item_icon_group_id", group.ID).Error; err != nil {
			return nil, err
		}
		groups = append(groups, group)
	}
	return groups, nil
}

func (a *ItemIconGroup) GetList(c *gin.Context) {
	user, _ := base.GetCurrentUserInfo(c)
	var groups []models.ItemIconGroup
	err := global.Db.Transaction(func(tx *gorm.DB) error {
		var err error
		groups, err = readGroups(tx, user.ID)
		return err
	})
	if err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	apiReturn.SuccessListData(c, groups, 0)
}

type navigationGroup struct {
	models.ItemIconGroup
	Items []models.ItemIcon `json:"items"`
}

// Read a consistent navigation snapshot in two queries, independent of group count.
func (a *ItemIconGroup) GetNavigation(c *gin.Context) {
	user, _ := base.GetCurrentUserInfo(c)
	result := []navigationGroup{}
	err := global.Db.Transaction(func(tx *gorm.DB) error {
		groups, err := readGroups(tx, user.ID)
		if err != nil {
			return err
		}
		items := []models.ItemIcon{}
		if err := tx.Order("sort, created_at, id").Where("user_id=?", user.ID).Find(&items).Error; err != nil {
			return err
		}
		grouped := map[uint][]models.ItemIcon{}
		for _, item := range items {
			if err := json.Unmarshal([]byte(item.IconJson), &item.Icon); err != nil {
				item.Icon = datatype.ItemIconIconInfo{ItemType: 1}
			}
			grouped[uint(item.ItemIconGroupId)] = append(grouped[uint(item.ItemIconGroupId)], item)
		}
		for _, group := range groups {
			list := grouped[group.ID]
			if list == nil {
				list = []models.ItemIcon{}
			}
			result = append(result, navigationGroup{ItemIconGroup: group, Items: list})
		}
		return nil
	})
	if err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	apiReturn.SuccessData(c, result)
}

func (a *ItemIconGroup) Deletes(c *gin.Context) {
	req := struct {
		Ids           []uint `json:"ids"`
		MoveToGroupID uint   `json:"moveToGroupId"`
	}{}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	user, _ := base.GetCurrentUserInfo(c)
	lastGroup := false
	invalidTarget := false
	err := global.Db.Transaction(func(tx *gorm.DB) error {
		groups := []models.ItemIconGroup{}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("user_id=?", user.ID).Find(&groups).Error; err != nil {
			return err
		}
		deleting := map[uint]bool{}
		for _, id := range req.Ids {
			deleting[id] = true
		}
		matched := []uint{}
		targetExists := false
		for _, group := range groups {
			if deleting[group.ID] {
				matched = append(matched, group.ID)
			}
			if group.ID == req.MoveToGroupID && !deleting[group.ID] {
				targetExists = true
			}
		}
		if len(matched) == 0 {
			return nil
		}
		if len(matched) == len(groups) {
			lastGroup = true
			return fmt.Errorf("at least one group must be retained")
		}
		if req.MoveToGroupID != 0 {
			if !targetExists {
				invalidTarget = true
				return fmt.Errorf("invalid destination group")
			}
			if err := tx.Model(&models.ItemIcon{}).Where("user_id=? AND item_icon_group_id IN ?", user.ID, matched).Update("item_icon_group_id", req.MoveToGroupID).Error; err != nil {
				return err
			}
		} else if err := (&models.ItemIcon{}).DeleteByItemIconGroupIds(tx, user.ID, matched); err != nil {
			return err
		}
		return tx.Delete(&models.ItemIconGroup{}, "id IN ? AND user_id=?", matched, user.ID).Error
	})
	if lastGroup {
		apiReturn.ErrorCode(c, 1201, "At least one group must be retained", nil)
		return
	}
	if invalidTarget {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	if err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	apiReturn.Success(c)
}

// 保存排序
func (a *ItemIconGroup) SaveSort(c *gin.Context) {
	req := commonApiStructs.SortRequest{}

	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	userInfo, _ := base.GetCurrentUserInfo(c)

	transactionErr := global.Db.Transaction(func(tx *gorm.DB) error {
		// 在事务中执行一些 db 操作（从这里开始，您应该使用 'tx' 而不是 'db'）
		for _, v := range req.SortItems {
			if err := tx.Model(&models.ItemIconGroup{}).Where("user_id=? AND id=?", userInfo.ID, v.Id).Update("sort", v.Sort).Error; err != nil {
				// 返回任何错误都会回滚事务
				return err
			}
		}

		// 返回 nil 提交事务
		return nil
	})

	if transactionErr != nil {
		apiReturn.ErrorDatabase(c, transactionErr.Error())
		return
	}

	apiReturn.Success(c)
}

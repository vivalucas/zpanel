package system

import (
	"zpanel/api/api_v1/common/apiData/systemApiStructs"
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/global"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

type NoticeApi struct {
}

func (a *NoticeApi) GetListByDisplayType(c *gin.Context) {
	req := systemApiStructs.NoticeGetListByDisplayTypeReq{}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	noticeList := []models.Notice{}
	if err := global.Db.Find(&noticeList, "display_type in ?", req.DisplayType).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	apiReturn.SuccessListData(c, noticeList, int64(len(noticeList)))
}

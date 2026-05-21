package middleware

import (
	"time"
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/api/api_v1/common/base"
	"zpanel/global"
	"zpanel/lib/cmn/systemSetting"
	"zpanel/models"

	"github.com/gin-gonic/gin"
)

// 公开访问模式（访客模式）
// [有token将自动登录，无token/过期将使用公开账号，不可以与LoginInterceptor一起使用]
func PublicModeInterceptor(c *gin.Context) {

	// 获得token
	rawToken := c.GetHeader("token")

	// 没有token信息视为未登录
	if rawToken != "" {
		if userInfo, success := global.UserToken.Get(rawToken); success {
			c.Set("userInfo", userInfo)
			return
		}
		if session, err := models.GetActiveSessionByToken(global.Db, rawToken); err == nil && session.User.ID != 0 {
			info := session.User
			info.Token = rawToken
			now := time.Now()
			_ = global.Db.Model(&models.Session{}).Where("id=?", session.ID).Update("last_seen_at", now).Error
			global.UserToken.SetDefault(rawToken, info)
			c.Set("userInfo", info)
			return
		} else {
			global.Logger.Debug("数据库查询用户失败")
		}
	} else {
		global.Logger.Debug("token不存在")
	}

	// 获取公开账号的信息
	var userId *uint
	if err := global.SystemSetting.GetValueByInterface(systemSetting.PANEL_PUBLIC_USER_ID, &userId); err == nil && userId != nil {
		userInfo := models.User{}
		if err := global.Db.First(&userInfo, "id=?", userId).Error; err != nil {
			apiReturn.ErrorCode(c, 1001, global.Lang.Get("login.err_token_expire"), nil)
			c.Abort()
			return
		}
		global.Logger.Debug("访客用户ID:", userInfo.ID)
		c.Set("userInfo", userInfo)
		c.Set(base.GIN_GET_VISIT_MODE, base.VISIT_MODE_PUBLIC)
		return
	} else {
		global.Logger.Debug("访客用户不存在:", userId)
		apiReturn.ErrorCode(c, 1001, global.Lang.Get("login.err_token_expire"), nil)
		c.Abort()
		return
	}

}

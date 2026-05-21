package middleware

import (
	"time"
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/global"
	"zpanel/models"

	"github.com/gin-gonic/gin"
)

func LoginInterceptor(c *gin.Context) {

	// 继续执行后续的操作，再回来
	// c.Next()

	// 获得token
	rawToken := c.GetHeader("token")

	// 没有token信息视为未登录
	if rawToken == "" {
		apiReturn.ErrorByCode(c, 1000)
		c.Abort() // 终止执行后续的操作，一般配合return使用
		return
	}

	// 直接返回缓存的用户信息
	if userInfo, success := global.UserToken.Get(rawToken); success {
		c.Set("userInfo", userInfo)
		return
	}

	global.Logger.Debug("准备查询数据库的用户资料")

	// 去库中查询是否存在该用户；否则返回错误
	if session, err := models.GetActiveSessionByToken(global.Db, rawToken); err != nil || session.User.ID == 0 {
		apiReturn.ErrorCode(c, 1001, global.Lang.Get("login.err_token_expire"), nil)
		c.Abort()
		return
	} else {
		// 通过 设置当前用户信息
		info := session.User
		info.Token = rawToken
		now := time.Now()
		_ = global.Db.Model(&models.Session{}).Where("id=?", session.ID).Update("last_seen_at", now).Error
		global.UserToken.SetDefault(rawToken, info)
		c.Set("userInfo", info)
	}

}

// 不验证缓存直接验证库省去没有缓存每次都要手动登录的问题
func LoginInterceptorDev(c *gin.Context) {

	// 获得token
	rawToken := c.GetHeader("token")

	// 去库中查询是否存在该用户；否则返回错误
	if session, err := models.GetActiveSessionByToken(global.Db, rawToken); err != nil || session.User.ID == 0 {
		apiReturn.ErrorCode(c, 1001, global.Lang.Get("login.err_token_expire"), nil)
		c.Abort()
		return
	} else {
		// 通过
		// 设置当前用户信息
		info := session.User
		info.Token = rawToken
		c.Set("userInfo", info)
	}
}

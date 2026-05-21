package system

import (
	"encoding/base64"
	"strconv"
	"strings"
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/api/api_v1/common/base"
	"zpanel/global"
	"zpanel/lib/captcha"
	"zpanel/lib/cmn"
	"zpanel/lib/cmn/systemSetting"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LoginApi struct {
}

// 登录输入验证
type LoginLoginVerify struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required,max=50"`
	VCode    string `json:"vcode" validate:"max=6"`
	Email    string `json:"email"`
}

// @Summary 登录账号
// @Accept application/json
// @Produce application/json
// @Param LoginLoginVerify body LoginLoginVerify true "登陆验证信息"
// @Tags user
// @Router /login [post]
func (l LoginApi) Login(c *gin.Context) {
	param := LoginLoginVerify{}
	if err := c.ShouldBindJSON(&param); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	if errMsg, err := base.ValidateInputStruct(param); err != nil {
		apiReturn.ErrorParamFomat(c, errMsg)
		return
	}

	settings := systemSetting.ApplicationSetting{}
	global.SystemSetting.GetValueByInterface("system_application", &settings)
	if settings.LoginCaptcha {
		if !captcha.CaptchaVerifyHandle(param.Email, param.VCode) {
			apiReturn.ErrorByCode(c, 2001)
			return
		}
	}

	mUser := models.User{}
	var (
		err  error
		info models.User
	)
	bToken := ""
	param.Username = strings.TrimSpace(param.Username)
	if info, err = mUser.GetUserInfoByUsername(param.Username); err != nil {
		// 未找到记录 账号或密码错误
		if err == gorm.ErrRecordNotFound {
			apiReturn.ErrorByCode(c, 1003)
			return
		} else {
			// 未知错误
			apiReturn.Error(c, err.Error())
			return
		}
	}
	// 验证密码（兼容 bcrypt 和旧 MD5 哈希）
	if !cmn.VerifyPassword(param.Password, info.Password) {
		apiReturn.ErrorByCode(c, 1003)
		return
	}

	// 停用或未激活
	if info.Status != 1 {
		apiReturn.ErrorByCode(c, 1004)
		return
	}

	bToken = info.Token
	if info.Token == "" {
		// 生成token
		buildTokenOver := false
		for !buildTokenOver {
			bToken = cmn.BuildRandCode(32, cmn.RAND_CODE_MODE2)
			if _, err := mUser.GetUserInfoByToken(bToken); err != nil {
				// 保存token
				mUser.UpdateUserInfoByUserId(info.ID, map[string]interface{}{
					"token": bToken,
				})
				buildTokenOver = true
			}
		}
		info.Token = bToken
	}
	info.Password = ""
	info.ReferralCode = ""

	// global.UserToken.SetDefault(bToken, info)
	cToken := uuid.NewString() + "-" + cmn.Md5(cmn.Md5("userId"+strconv.Itoa(int(info.ID))))
	global.CUserToken.SetDefault(cToken, bToken)
	global.Logger.Debug("token:", cToken, "|", bToken)
	global.Logger.Debug(global.CUserToken.Get(cToken))

	// 设置当前用户信息
	c.Set("userInfo", info)
	info.Token = cToken // 重要 采用cToken,隐藏真实token
	apiReturn.SuccessData(c, info)
}

func (l LoginApi) CaptchaImage(c *gin.Context) {
	id := c.Param("id")
	width, _ := strconv.Atoi(c.Param("width"))
	height, _ := strconv.Atoi(c.Param("height"))
	if id == "" {
		apiReturn.ErrorParamFomat(c, "captcha id is required")
		return
	}
	if width <= 0 {
		width = 120
	}
	if height <= 0 {
		height = 40
	}
	imageData := captcha.GenerateCaptchaHandler(id, width, height)
	imageData = strings.TrimPrefix(imageData, "data:image/png;base64,")
	bytes, err := base64.StdEncoding.DecodeString(imageData)
	if err != nil {
		apiReturn.Error(c, err.Error())
		return
	}
	c.Data(200, "image/png", bytes)
}

// 安全退出
func (l *LoginApi) Logout(c *gin.Context) {
	// userInfo, _ := base.GetCurrentUserInfo(c)
	cToken := c.GetHeader("token")
	global.CUserToken.Delete(cToken)
	apiReturn.Success(c)
}

package models

import (
	"errors"
)

// 用户表
type User struct {
	BaseModel
	Username     string  `gorm:"type:varchar(64);uniqueIndex;not null" json:"username" validate:"required"` // 账号
	Password     string  `gorm:"column:password_hash;type:varchar(255);not null" json:"password" validate:"required"`
	PasswordAlgo string  `gorm:"type:varchar(32);not null;default:bcrypt" json:"passwordAlgo"`
	Name         string  `gorm:"type:varchar(64);not null" json:"name"`                  // 名称
	HeadImage    string  `gorm:"type:varchar(2048)" json:"headImage"`                    // 头像地址
	Status       int     `gorm:"type:tinyint(1);index;not null;default:1" json:"status"` // 状态 1.启用 2.停用 3.未激活
	Role         int     `gorm:"type:int(11);index;not null;default:2" json:"role"`      // 角色 1.管理员 2.普通用户
	Mail         *string `gorm:"type:varchar(255);uniqueIndex" json:"mail"`              // 邮箱
	AvatarFileID *uint   `gorm:"index" json:"avatarFileId"`                              // 头像文件
	Token        string  `gorm:"-" json:"token,omitempty"`
	ReferralCode string  `gorm:"-" json:"referralCode,omitempty"`

	UserId uint `gorm:"-"  json:"userId"`
}

// 获取用户信息
func (m *User) GetUserInfoByUid(uid uint) (User, error) {
	mUser := User{}
	err := Db.Where("id=?", uid).First(&mUser).Error
	return mUser, err
}

// 根据用户名和密码查询用户
func (m *User) GetUserInfoByUsernameAndPassword(username, password string) (User, error) {
	userInfo := User{}
	err := Db.Where("username=?", username).Where("password=?", password).First(&userInfo).Error
	return userInfo, err
}

// 根据用户名查询用户
func (m *User) GetUserInfoByUsername(username string) (User, error) {
	mUser := User{}
	err := Db.Where("username=?", username).First(&mUser).Error
	return mUser, err
}

// 根据邮箱查询用户
func (m *User) GetUserInfoByMail() *User {
	if m.Mail == nil || *m.Mail == "" {
		return nil
	}
	mUser := User{}
	if Db.Where("mail=?", m.Mail).First(&mUser).Error != nil {
		return nil
	}
	return &mUser
}

// 根据token查询用户
func (m *User) GetUserInfoByToken(userToken string) (User, error) {
	session, err := GetActiveSessionByToken(Db, userToken)
	if err != nil {
		return User{}, err
	}
	user := session.User
	user.Token = userToken
	return user, nil
}

// 更新用户基于id
// 支持：name,autograph,header_image,status,role,mail,token,password,username,gender
func (m *User) UpdateUserInfoByUserId(user_id uint, updateInfo map[string]interface{}) error {
	mUser := User{}

	data := map[string]interface{}{}
	if v, ok := updateInfo["name"]; ok {
		data["name"] = v
	}
	if v, ok := updateInfo["head_image"]; ok {
		data["head_image"] = v
	}
	if v, ok := updateInfo["status"]; ok {
		data["status"] = v
	}
	if v, ok := updateInfo["role"]; ok {
		data["role"] = v
	}
	if v, ok := updateInfo["gender"]; ok {
		data["gender"] = v
	}

	if v, ok := updateInfo["mail"]; ok {
		if mail, ok := normalizeMail(v); ok {
			hasUser := User{}
			count := Db.Where("mail=?", mail).First(&hasUser).RowsAffected
			if count != 0 && hasUser.ID != user_id {
				return errors.New("the mail already exists")
			}
			data["mail"] = &mail
		} else {
			data["mail"] = nil
		}
	}
	if v, ok := updateInfo["username"]; ok {
		hasUser := User{}
		count := Db.Where("username=?", updateInfo["username"]).First(&hasUser).RowsAffected
		if count != 0 && hasUser.ID != user_id {
			return errors.New("the username already exists")
		}
		data["username"] = v
	}
	if v, ok := updateInfo["password"]; ok {
		data["password"] = v
	}

	err := Db.Model(&mUser).Where("id=?", user_id).Updates(data).Error

	return err
}

// 添加一个
func (m *User) CreateOne() (User, error) {
	err := Db.Create(m).Error
	return *m, err
}

// 验证是否有重复的用户名或者邮箱
func (m *User) CheckMailAndUsername(mail, username string) error {
	hasUser := User{}
	if mail != "" {
		count := Db.Where("mail=?", mail).First(&hasUser).RowsAffected
		if count != 0 {
			return errors.New("该邮箱已被注册")
		}
	}

	count := Db.Where("username=?", username).First(&hasUser).RowsAffected
	if count != 0 {
		return errors.New("该用户名已被注册")
	}
	return nil
}

// 验证是否有重复的用户名或者邮箱
func (m *User) CheckMailExist(mail string) (User, error) {
	hasUser := User{}
	if mail == "" {
		return hasUser, nil
	}
	count := Db.Where("mail=?", mail).First(&hasUser).RowsAffected
	if count != 0 {
		return hasUser, errors.New("该邮箱已被注册")
	}
	return hasUser, nil
}

func normalizeMail(value interface{}) (string, bool) {
	switch v := value.(type) {
	case string:
		return v, v != ""
	case *string:
		if v == nil || *v == "" {
			return "", false
		}
		return *v, true
	default:
		return "", false
	}
}

// 验证是否有重复的用户名或者邮箱
func (m *User) CheckUsernameExist(username string) (User, error) {
	hasUser := User{}
	count := Db.Where("username=?", username).First(&hasUser).RowsAffected
	if count != 0 {
		return hasUser, errors.New("该用户名已被注册")
	}
	return hasUser, nil
}

// // 根据用户名和密码查询用户
// func (m *User) CreateUser(uid uint) *User {
// 	mUser := User{}
// 	if Db.Where("id=?", uid).First(&mUser).Error != nil {
// 		return nil
// 	} else {
// 		return &mUser
// 	}
// }

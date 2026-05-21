package models

import (
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Session struct {
	BaseModel
	UserID     uint       `gorm:"index;not null" json:"userId"`
	TokenHash  string     `gorm:"type:varchar(64);uniqueIndex;not null" json:"-"`
	Name       string     `gorm:"type:varchar(128)" json:"name"`
	IPAddress  string     `gorm:"type:varchar(64)" json:"ipAddress"`
	UserAgent  string     `gorm:"type:varchar(512)" json:"userAgent"`
	LastSeenAt *time.Time `gorm:"index" json:"lastSeenAt"`
	ExpiresAt  time.Time  `gorm:"index;not null" json:"expiresAt"`
	RevokedAt  *time.Time `gorm:"index" json:"revokedAt"`
	User       User       `json:"user"`
}

func NewSession(userID uint, ipAddress, userAgent string) (Session, string) {
	rawToken := uuid.NewString() + uuid.NewString()
	now := time.Now()
	return Session{
		UserID:     userID,
		TokenHash:  HashToken(rawToken),
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
		LastSeenAt: &now,
		ExpiresAt:  now.Add(30 * 24 * time.Hour),
	}, rawToken
}

func HashToken(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

func GetActiveSessionByToken(db *gorm.DB, rawToken string) (Session, error) {
	session := Session{}
	now := time.Now()
	err := db.Preload("User").
		Where("token_hash = ? AND revoked_at IS NULL AND expires_at > ?", HashToken(rawToken), now).
		First(&session).Error
	return session, err
}

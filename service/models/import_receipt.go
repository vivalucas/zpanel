package models

// ImportReceipt makes retrying an interrupted client request safe.
type ImportReceipt struct {
	UserID      uint   `gorm:"primaryKey"`
	RequestID   string `gorm:"primaryKey;size:64"`
	PayloadHash string `gorm:"size:64;not null"`
}

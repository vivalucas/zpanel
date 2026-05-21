package models

type FileReference struct {
	BaseModel
	FileID  uint   `gorm:"index;not null" json:"fileId"`
	OwnerID uint   `gorm:"index;not null" json:"ownerId"`
	RefType string `gorm:"type:varchar(64);index;not null" json:"refType"`
	RefID   *uint  `gorm:"index" json:"refId"`
}

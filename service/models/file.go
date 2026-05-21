package models

const (
	FileVisibilityPrivate = "private"
	FileVisibilityPublic  = "public"
	FileVisibilitySystem  = "system"

	FilePurposeIcon       = "icon"
	FilePurposeWallpaper  = "wallpaper"
	FilePurposeAvatar     = "avatar"
	FilePurposeSiteIcon   = "site_icon"
	FilePurposeAttachment = "attachment"
	FilePurposeBackup     = "backup"

	FileStatusActive       = "active"
	FileStatusOrphaned     = "orphaned"
	FileStatusDeleted      = "deleted"
	FileStatusDeleteFailed = "delete_failed"
)

type File struct {
	BaseModel
	OwnerID      uint   `gorm:"index;not null" json:"ownerId"`
	Storage      string `gorm:"type:varchar(32);not null;default:local" json:"storage"`
	ObjectKey    string `gorm:"type:varchar(255);uniqueIndex;not null" json:"objectKey"`
	RelativePath string `gorm:"type:varchar(2048);uniqueIndex;not null" json:"relativePath"`
	SourceURL    string `gorm:"type:varchar(2048)" json:"sourceUrl"`
	OriginalName string `gorm:"type:varchar(255);not null" json:"originalName"`
	MimeType     string `gorm:"type:varchar(255);not null" json:"mimeType"`
	Ext          string `gorm:"type:varchar(32);not null" json:"ext"`
	Size         int64  `gorm:"not null;default:0" json:"size"`
	SHA256       string `gorm:"type:varchar(64);index" json:"sha256"`
	Visibility   string `gorm:"type:varchar(32);index;not null;default:private" json:"visibility"`
	Purpose      string `gorm:"type:varchar(32);index;not null;default:attachment" json:"purpose"`
	Status       string `gorm:"type:varchar(32);index;not null;default:active" json:"status"`

	Src      string `gorm:"-" json:"src"`
	UserId   uint   `gorm:"-" json:"userId"`
	FileName string `gorm:"-" json:"fileName"`
	Method   int    `gorm:"-" json:"method"`
}

type AddFileInput struct {
	OwnerID      uint
	ObjectKey    string
	RelativePath string
	SourceURL    string
	OriginalName string
	MimeType     string
	Ext          string
	Size         int64
	SHA256       string
	Visibility   string
	Purpose      string
}

func (m *File) AddFile(input AddFileInput) (File, error) {
	if input.Visibility == "" {
		input.Visibility = FileVisibilityPrivate
	}
	if input.Purpose == "" {
		input.Purpose = FilePurposeAttachment
	}
	file := File{
		OwnerID:      input.OwnerID,
		Storage:      "local",
		ObjectKey:    input.ObjectKey,
		RelativePath: input.RelativePath,
		SourceURL:    input.SourceURL,
		OriginalName: input.OriginalName,
		MimeType:     input.MimeType,
		Ext:          input.Ext,
		Size:         input.Size,
		SHA256:       input.SHA256,
		Visibility:   input.Visibility,
		Purpose:      input.Purpose,
		Status:       FileStatusActive,
	}
	err := Db.Create(&file).Error

	return file, err
}

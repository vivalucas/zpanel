package system

import (
	"fmt"
	"os"
	"strings"
	"zpanel/api/api_v1/common/apiData/commonApiStructs"
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/api/api_v1/common/base"
	"zpanel/global"
	"zpanel/lib/storage"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
)

type FileApi struct{}

var allowedImageExts = []string{".png", ".jpg", ".gif", ".jpeg", ".webp", ".svg", ".ico"}

func (a *FileApi) UploadImg(c *gin.Context) {
	userInfo, _ := base.GetCurrentUserInfo(c)
	f, err := c.FormFile("imgfile")
	if err != nil {
		apiReturn.ErrorByCode(c, 1300)
		return
	}

	stored, err := storage.StoreUpload(f, userInfo.ID, models.FilePurposeAttachment, models.FileVisibilityPublic, allowedImageExts)
	if err != nil {
		if strings.Contains(err.Error(), "unsupported") {
			apiReturn.ErrorByCode(c, 1301)
			return
		}
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	file, err := (&models.File{}).AddFile(models.AddFileInput{
		OwnerID:      userInfo.ID,
		ObjectKey:    stored.ObjectKey,
		RelativePath: stored.RelativePath,
		OriginalName: f.Filename,
		MimeType:     stored.MimeType,
		Ext:          stored.Ext,
		Size:         stored.Size,
		SHA256:       stored.SHA256,
		Visibility:   models.FileVisibilityPublic,
		Purpose:      models.FilePurposeAttachment,
	})
	if err != nil {
		_ = os.Remove(stored.AbsolutePath)
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	apiReturn.SuccessData(c, gin.H{
		"fileId":   file.ID,
		"imageUrl": storage.PublicPath(file.RelativePath),
	})
}

func (a *FileApi) UploadFiles(c *gin.Context) {
	userInfo, _ := base.GetCurrentUserInfo(c)

	form, err := c.MultipartForm()
	if err != nil {
		apiReturn.ErrorByCode(c, 1300)
		return
	}
	files := form.File["files[]"]
	errFiles := []string{}
	succMap := map[string]string{}
	for _, f := range files {
		stored, storeErr := storage.StoreUpload(f, userInfo.ID, models.FilePurposeAttachment, models.FileVisibilityPublic, nil)
		if storeErr != nil {
			errFiles = append(errFiles, f.Filename)
		} else {
			file, addErr := (&models.File{}).AddFile(models.AddFileInput{
				OwnerID:      userInfo.ID,
				ObjectKey:    stored.ObjectKey,
				RelativePath: stored.RelativePath,
				OriginalName: f.Filename,
				MimeType:     stored.MimeType,
				Ext:          stored.Ext,
				Size:         stored.Size,
				SHA256:       stored.SHA256,
				Visibility:   models.FileVisibilityPublic,
				Purpose:      models.FilePurposeAttachment,
			})
			if addErr != nil {
				_ = os.Remove(stored.AbsolutePath)
				errFiles = append(errFiles, f.Filename)
				continue
			}
			succMap[f.Filename] = storage.PublicPath(file.RelativePath)
		}
	}

	apiReturn.SuccessData(c, gin.H{
		"succMap":  succMap,
		"errFiles": errFiles,
	})
}

func (a *FileApi) GetList(c *gin.Context) {
	param := commonApiStructs.RequestPage{}
	userInfo, _ := base.GetCurrentUserInfo(c)
	if err := c.ShouldBindBodyWith(&param, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	page := param.Page
	if page <= 0 {
		page = 1
	}
	limit := param.Limit
	if limit <= 0 {
		limit = 24
	}
	if limit > 100 {
		limit = 100
	}

	list := []models.File{}
	var count int64
	countQuery := global.Db.Model(&models.File{}).Where("owner_id=? AND status=?", userInfo.ID, models.FileStatusActive)
	if err := countQuery.Count(&count).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	listQuery := global.Db.Model(&models.File{}).Where("owner_id=? AND status=?", userInfo.ID, models.FileStatusActive)
	if err := listQuery.Order("created_at desc").Limit(limit).Offset((page - 1) * limit).Find(&list).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	data := []map[string]interface{}{}
	for _, v := range list {
		data = append(data, fileResponse(v))
	}
	apiReturn.SuccessListData(c, data, count)
}

func (a *FileApi) GetPublicList(c *gin.Context) {
	param := commonApiStructs.RequestPage{}
	if err := c.ShouldBindBodyWith(&param, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	page := param.Page
	if page <= 0 {
		page = 1
	}
	limit := param.Limit
	if limit <= 0 {
		limit = 24
	}
	if limit > 100 {
		limit = 100
	}

	list := []models.File{}
	var count int64
	countQuery := global.Db.Model(&models.File{}).Where("visibility=? AND status=?", models.FileVisibilityPublic, models.FileStatusActive)
	if err := countQuery.Count(&count).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	listQuery := global.Db.Model(&models.File{}).Where("visibility=? AND status=?", models.FileVisibilityPublic, models.FileStatusActive)
	if err := listQuery.Order("created_at desc").Limit(limit).Offset((page - 1) * limit).Find(&list).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	data := []map[string]interface{}{}
	for _, v := range list {
		data = append(data, fileResponse(v))
	}
	apiReturn.SuccessListData(c, data, count)
}

func (a *FileApi) Deletes(c *gin.Context) {
	req := commonApiStructs.RequestDeleteIds[uint]{}
	userInfo, _ := base.GetCurrentUserInfo(c)
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	files := []models.File{}
	if err := global.Db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.File{}).Where("owner_id=? AND id in ? AND status=?", userInfo.ID, req.Ids, models.FileStatusActive).Find(&files).Error; err != nil {
			return err
		}
		for _, v := range files {
			var refCount int64
			if err := tx.Model(&models.FileReference{}).Where("file_id=?", v.ID).Count(&refCount).Error; err != nil {
				return err
			}
			if refCount > 0 {
				return fmt.Errorf("file %d is still referenced", v.ID)
			}
		}
		return nil
	}); err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	deletedIDs := []uint{}
	failedIDs := []uint{}
	for _, v := range files {
		if err := os.Remove(storage.AbsolutePath(v.RelativePath)); err != nil && !os.IsNotExist(err) {
			_ = global.Db.Model(&models.File{}).Where("id=?", v.ID).Update("status", models.FileStatusDeleteFailed).Error
			failedIDs = append(failedIDs, v.ID)
			continue
		}
		if err := global.Db.Delete(&models.File{}, "id=?", v.ID).Error; err != nil {
			_ = global.Db.Model(&models.File{}).Where("id=?", v.ID).Update("status", models.FileStatusDeleteFailed).Error
			failedIDs = append(failedIDs, v.ID)
			continue
		}
		deletedIDs = append(deletedIDs, v.ID)
	}

	apiReturn.SuccessData(c, gin.H{
		"deletedIds": deletedIDs,
		"failedIds":  failedIDs,
	})

}

func (a *FileApi) DeletesBatch(c *gin.Context) {
	a.Deletes(c)
}

func fileResponse(v models.File) map[string]interface{} {
	src := storage.PublicPath(v.RelativePath)
	return map[string]interface{}{
		"src":          src,
		"fileName":     v.OriginalName,
		"originalName": v.OriginalName,
		"id":           v.ID,
		"userId":       v.OwnerID,
		"ownerId":      v.OwnerID,
		"createTime":   v.CreatedAt,
		"updateTime":   v.UpdatedAt,
		"path":         v.RelativePath,
		"relativePath": v.RelativePath,
		"objectKey":    v.ObjectKey,
		"mimeType":     v.MimeType,
		"ext":          v.Ext,
		"size":         v.Size,
		"sha256":       v.SHA256,
		"visibility":   v.Visibility,
		"purpose":      v.Purpose,
		"status":       v.Status,
	}
}

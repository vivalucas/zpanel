package system

import (
	"fmt"
	"mime/multipart"
	"os"
	"zpanel/global"
	"zpanel/lib/resourceguard"
	"zpanel/lib/storage"
	"zpanel/models"
)

// storeUploadedImage keeps one gallery object per matching upload in this
// account. File ownership, visibility, and existing URL references stay intact.
func storeUploadedImage(header *multipart.FileHeader, ownerID uint) (models.File, error) {
	prepared, err := storage.PrepareUpload(header, allowedImageExts)
	if err != nil {
		return models.File{}, err
	}
	defer prepared.Close()

	// Upload parsing and fingerprinting finish before locking. Share the lock
	// with deletion/settings writes, not just other upload requests.
	unlock := resourceguard.LockMutation()
	defer unlock()
	candidates := []models.File{}
	if err := global.Db.Where(
		"owner_id=? AND storage=? AND visibility=? AND purpose=? AND status=? AND sha256=? AND size=?",
		ownerID, "local", models.FileVisibilityPublic, models.FilePurposeAttachment,
		models.FileStatusActive, prepared.SHA256, prepared.Size,
	).Order("id").Find(&candidates).Error; err != nil {
		return models.File{}, err
	}
	for _, candidate := range candidates {
		matches, err := prepared.Matches(candidate.RelativePath)
		if err != nil {
			return models.File{}, err
		}
		if matches {
			return candidate, nil
		}
	}

	stored, err := prepared.Store(ownerID, models.FilePurposeAttachment, models.FileVisibilityPublic)
	if err != nil {
		return models.File{}, err
	}
	file, err := (&models.File{}).AddFile(models.AddFileInput{
		OwnerID: ownerID, ObjectKey: stored.ObjectKey, RelativePath: stored.RelativePath,
		OriginalName: header.Filename, MimeType: stored.MimeType, Ext: stored.Ext,
		Size: stored.Size, SHA256: stored.SHA256,
		Visibility: models.FileVisibilityPublic, Purpose: models.FilePurposeAttachment,
	})
	if err != nil {
		if cleanupErr := os.Remove(stored.AbsolutePath); cleanupErr != nil && !os.IsNotExist(cleanupErr) {
			return models.File{}, fmt.Errorf("%w; upload cleanup failed: %v", err, cleanupErr)
		}
		return models.File{}, err
	}
	return file, nil
}

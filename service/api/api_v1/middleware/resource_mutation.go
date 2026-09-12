package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"zpanel/api/api_v1/common/apiReturn"
	"zpanel/global"
	"zpanel/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var mutationMu sync.Mutex

// ResourceMutation serializes related writes in this server, including legacy
// JSON references, so a delete cannot race a settings save or import.
func ResourceMutation(c *gin.Context) {
	// Restore the body for the handler. Reject references to files deleted by
	// an earlier request while this request was waiting for the mutation lock.
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 5*1024*1024))
	if err != nil {
		apiReturn.Error(c, "request too large")
		c.Abort()
		return
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	var value interface{}
	validJSON := json.Unmarshal(body, &value) == nil
	// Never hold the shared write lock while waiting for a client to upload.
	mutationMu.Lock()
	defer mutationMu.Unlock()
	if validJSON {
		if err := checkLocalFiles(value); err != nil {
			apiReturn.Error(c, err.Error())
			c.Abort()
			return
		}
	}
	c.Next()
}

func checkLocalFiles(value interface{}) error {
	return checkLocalFilesOnce(value, map[string]bool{})
}

func checkLocalFilesOnce(value interface{}, checked map[string]bool) error {
	switch v := value.(type) {
	case map[string]interface{}:
		for _, child := range v {
			if err := checkLocalFilesOnce(child, checked); err != nil {
				return err
			}
		}
	case []interface{}:
		for _, child := range v {
			if err := checkLocalFilesOnce(child, checked); err != nil {
				return err
			}
		}
	case string:
		if !strings.HasPrefix(v, "/uploads/") {
			return nil
		}
		parsed, err := url.Parse(v)
		if err != nil {
			return err
		}
		if checked[parsed.Path] {
			return nil
		}
		checked[parsed.Path] = true
		file := models.File{}
		err = global.Db.Unscoped().Where("relative_path=?", strings.TrimPrefix(parsed.Path, "/uploads/")).First(&file).Error
		if err == gorm.ErrRecordNotFound {
			return nil
		} // manually hosted or separately migrated assets
		if err != nil {
			return err
		}
		if file.DeletedAt.Valid || file.Status != models.FileStatusActive {
			return fmt.Errorf("referenced image was deleted; choose another image")
		}
	}
	return nil
}

package router

import (
	"strings"
	"zpanel/lib/storage"

	"github.com/gin-gonic/gin"
)

func uploadThumbnail(c *gin.Context) {
	if c.Query("thumbnail") != "1" {
		return
	}
	filename, err := storage.Thumbnail(strings.TrimPrefix(c.Param("filepath"), "/"))
	if err != nil {
		// Unsupported, small, missing or invalid images retain the original static behavior.
		return
	}
	c.File(filename)
	c.Abort()
}

package system

import (
	"testing"
	"zpanel/lib/storage"
	"zpanel/models"
)

func TestFileResponseOffersLazyThumbnailsWithoutReplacingOriginalSource(t *testing.T) {
	for ext, supported := range map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".webp": false, ".gif": false, ".ico": false, ".svg": false} {
		file := models.File{RelativePath: "public/gallery/source" + ext, OriginalName: "source" + ext, MimeType: "image/test"}
		response := fileResponse(file)
		src := storage.PublicPath(file.RelativePath)
		if response["src"] != src || response["relativePath"] != file.RelativePath {
			t.Fatalf("thumbnail altered original file fields: %+v", response)
		}
		thumbnail, present := response["thumbnailSrc"]
		if present != supported || (present && thumbnail != src+"?thumbnail=1") {
			t.Fatalf("unexpected thumbnail for %s: %+v", ext, response)
		}
	}
}

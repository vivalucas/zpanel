package apiReturn

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestMissingDataHasDistinctErrorCode(t *testing.T) {
	response := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(response)
	ErrorDataNotFound(ctx)
	var body struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Code != ERROR_CODE_DATA_RECORD_NOT_FOUND {
		t.Fatalf("missing data must be distinguishable from server errors, got %d", body.Code)
	}
}

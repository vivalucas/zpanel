package system

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"image/png"
	"net/http/httptest"
	"testing"
	"zpanel/global"
	"zpanel/lib/cmn"
	"zpanel/models"
)

func TestCaptchaDimensionsAreBounded(t *testing.T) {
	for _, sizes := range [][2]string{{"1", "1"}, {"100000", "100000"}, {"120", "40"}} {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Params = gin.Params{{Key: "id", Value: "test-id"}, {Key: "width", Value: sizes[0]}, {Key: "height", Value: sizes[1]}}
		(&LoginApi{}).CaptchaImage(c)
		cfg, err := png.DecodeConfig(bytes.NewReader(recorder.Body.Bytes()))
		if err != nil {
			t.Fatal(err)
		}
		if cfg.Width > 320 || cfg.Height > 120 || cfg.Width < 80 || cfg.Height < 30 {
			t.Fatal("unsafe dimensions")
		}
	}
}

func TestPasswordRollbackWhenRevocationFails(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	db.AutoMigrate(&models.User{}, &models.Session{})
	hash, _ := cmn.PasswordEncryption("old-password")
	user := models.User{Username: "admin", Password: hash, Role: 1, Status: 1}
	db.Create(&user)
	session, _ := models.NewSession(user.ID, "", "")
	db.Create(&session)
	db.Exec(`CREATE TRIGGER fail_revoke BEFORE UPDATE ON sessions BEGIN SELECT RAISE(ABORT, 'simulated failure'); END`)
	oldDb, oldModelsDb := global.Db, models.Db
	global.Db, models.Db = db, db
	t.Cleanup(func() { global.Db, models.Db = oldDb, oldModelsDb })
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/password", bytes.NewBufferString(`{"oldPassword":"old-password","newPassword":"new-password"}`))
	c.Set("userInfo", user)
	(&UserApi{}).UpdatePasssword(c)
	var response struct{ Code int }
	json.Unmarshal(recorder.Body.Bytes(), &response)
	if response.Code == 0 {
		t.Fatal("reported success after revocation failed")
	}
	db.First(&user, user.ID)
	if user.Password != hash {
		t.Fatal("password was not rolled back")
	}
}

func TestDockerCancellationAndOutputBound(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := dockerCmd(ctx, "ps"); err == nil {
		t.Fatal("expected cancelled command")
	}
	output := &boundedOutput{}
	input := make([]byte, 3*1024*1024)
	n, err := output.Write(input)
	if err != nil || n != len(input) || output.Len() != 2*1024*1024 || !output.truncated {
		t.Fatal("output not bounded")
	}
}

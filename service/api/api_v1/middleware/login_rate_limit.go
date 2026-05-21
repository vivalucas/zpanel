package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type ipRecord struct {
	count   int
	resetAt time.Time
}

var (
	ipRecords    = sync.Map{}
	maxPerMinute = 10
)

// LoginRateLimit 限制登录接口的 IP 请求频率
func LoginRateLimit(c *gin.Context) {
	ip := c.ClientIP()
	now := time.Now()

	val, _ := ipRecords.LoadOrStore(ip, &ipRecord{
		count:   0,
		resetAt: now.Add(time.Minute),
	})
	record := val.(*ipRecord)

	if now.After(record.resetAt) {
		record.count = 0
		record.resetAt = now.Add(time.Minute)
	}

	record.count++
	if record.count > maxPerMinute {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"code": 1008,
			"msg":  "Too many login attempts, please try again later",
		})
		c.Abort()
		return
	}

	c.Next()
}

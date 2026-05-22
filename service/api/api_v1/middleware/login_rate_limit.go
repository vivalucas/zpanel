package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type ipRecord struct {
	mu      sync.Mutex
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

	record.mu.Lock()
	if now.After(record.resetAt) {
		record.count = 0
		record.resetAt = now.Add(time.Minute)
	}

	record.count++
	exceeded := record.count > maxPerMinute
	record.mu.Unlock()

	if exceeded {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"code": 1008,
			"msg":  "Too many login attempts, please try again later",
		})
		c.Abort()
		return
	}

	c.Next()
}

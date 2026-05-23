package middleware

import (
	"sync"
	"time"
	"zpanel/api/api_v1/common/apiReturn"

	"github.com/gin-gonic/gin"
)

type ipRecord struct {
	count   int
	resetAt time.Time
}

var (
	ipRecords    = map[string]*ipRecord{}
	ipRecordsMu  sync.Mutex
	maxPerMinute = 10
)

// LoginRateLimit 限制登录接口的 IP 请求频率
func LoginRateLimit(c *gin.Context) {
	ip := c.ClientIP()
	now := time.Now()

	ipRecordsMu.Lock()

	for key, record := range ipRecords {
		if now.After(record.resetAt.Add(time.Minute)) {
			delete(ipRecords, key)
		}
	}

	record, ok := ipRecords[ip]
	if !ok {
		record = &ipRecord{
			count:   0,
			resetAt: now.Add(time.Minute),
		}
		ipRecords[ip] = record
	}

	if now.After(record.resetAt) {
		record.count = 0
		record.resetAt = now.Add(time.Minute)
	}

	record.count++
	exceeded := record.count > maxPerMinute
	ipRecordsMu.Unlock()

	if exceeded {
		apiReturn.ErrorByCode(c, 1008)
		c.Abort()
		return
	}

	c.Next()
}

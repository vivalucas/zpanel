package middleware

import (
	"github.com/gin-gonic/gin"
)

// SecurityHeaders 添加安全响应头
func SecurityHeaders(c *gin.Context) {
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("X-Frame-Options", "SAMEORIGIN")
	c.Header("X-XSS-Protection", "1; mode=block")
	c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
	c.Next()
}

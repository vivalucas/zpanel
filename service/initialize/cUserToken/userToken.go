package cUserToken

import (
	"zpanel/global"
	"zpanel/lib/cache"

	"time"
)

func InitCUserToken() cache.Cacher[string] {
	return global.NewCache[string](72*time.Hour, 48*time.Hour, "CUserToken")
}

// func InitVerifyCodeCachePool() {
// 	global.VerifyCodeCachePool = cache.NewGoCache(10*time.Minute, 60*time.Second)
// }

package other

import (
	"time"
	"zpanel/global"
	"zpanel/lib/cache"
)

func InitVerifyCodeCachePool() cache.Cacher[string] {
	return global.NewCache[string](10*time.Minute, 10*time.Minute, "VerifyCodeCachePool")

}

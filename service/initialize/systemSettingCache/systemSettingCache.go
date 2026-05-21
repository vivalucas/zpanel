package systemSettingCache

import (
	"time"
	"zpanel/global"
	"zpanel/lib/cmn/systemSetting"
)

func InItSystemSettingCache() *systemSetting.SystemSettingCache {
	return &systemSetting.SystemSettingCache{
		Cache: global.NewCache[interface{}](5*time.Hour, -1, "systemSettingCache"),
	}
}

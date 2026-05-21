package systemMonitor

import (
	"time"
	"zpanel/global"
	"zpanel/lib/cache"
	"zpanel/lib/monitor"
)

func Start(cacher cache.Cacher[global.ModelSystemMonitor], interval time.Duration) {
	go func() {

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				go func() {
					monitorInfo := GetInfo()
					// jsonByte, _ := json.Marshal(monitorInfo)
					// fmt.Println("系统监控：", string(jsonByte))
					cacher.SetDefault("value", monitorInfo)
				}()
			}
		}

	}()

}

func GetInfo() global.ModelSystemMonitor {

	var modelSystemMonitor global.ModelSystemMonitor

	if cpuInfo, err := monitor.GetCPUInfo(); err == nil {
		modelSystemMonitor.CPUInfo = cpuInfo
	}

	if v, err := monitor.GetDiskInfo(); err == nil {
		modelSystemMonitor.DiskInfo = v
	}

	if v, err := monitor.GetNetIOCountersInfo(); err == nil {
		modelSystemMonitor.NetIOCountersInfo = v
	}

	if v, err := monitor.GetMemoryInfo(); err == nil {
		modelSystemMonitor.MemoryInfo = v
	}

	return modelSystemMonitor
}

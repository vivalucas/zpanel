package runlog

import (
	"os"
	"zpanel/global"
	"zpanel/lib/cmn"

	"go.uber.org/zap"
)

func InitRunlog(runmode string, filePath string) (*zap.SugaredLogger, error) {

	runtimePath := "./runtime/runlog"
	if err := os.MkdirAll(runtimePath, 0755); err != nil {
		return nil, err
	}
	var level zap.AtomicLevel
	if runmode == "debug" {
		level = zap.NewAtomicLevelAt(zap.DebugLevel)
	} else {
		level = global.LoggerLevel
	}

	logger := cmn.InitLogger(runtimePath+"/"+filePath, level)
	return logger, nil
}

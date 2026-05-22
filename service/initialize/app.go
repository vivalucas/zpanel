package initialize

import (
	"flag"
	"fmt"
	"os"
	"time"
	"zpanel/global"
	"zpanel/initialize/config"
	"zpanel/initialize/database"
	"zpanel/initialize/lang"
	"zpanel/initialize/other"
	"zpanel/initialize/redis"
	"zpanel/initialize/runlog"
	"zpanel/initialize/systemSettingCache"
	"zpanel/initialize/userToken"
	"zpanel/lib/cmn"
	"zpanel/lib/storage"
	"zpanel/models"
	"zpanel/structs"

	"log"

	"github.com/gin-gonic/gin"
)

var DB_DRIVER = database.SQLITE

// var RUNCODE = "debug"
// var ISDOCER = "" // 是否为docker模式

func InitApp() error {
	Logo()
	gin.SetMode(global.RUNCODE) // GIN 运行模式

	// 配置初始化
	{
		if appConfig, err := config.ConfigInit(); err != nil {
			log.Println("Configuration initialization error", err)
			return err
		} else {
			global.Config = appConfig
		}
	}

	// 日志
	if logger, err := runlog.InitRunlog(global.RUNCODE, "running.log"); err != nil {
		log.Panicln("Log initialization error", err)
	} else {
		global.Logger = logger
	}

	// 命令行运行
	CommandRun()

	if err := storage.EnsureRuntimeDirs(); err != nil {
		global.Logger.Errorln("Runtime storage initialization error", err)
		return err
	}

	// 多语言初始化
	lang.LangInit("zh-cn") // en-us

	DatabaseConnect()

	// Redis 连接
	{
		// 判断是否有使用redis的驱动，没有将不连接
		cacheDrive := global.Config.GetValueString("base", "cache_drive")
		queueDrive := global.Config.GetValueString("base", "queue_drive")
		if cacheDrive == "redis" || queueDrive == "redis" {
			redisConfig := structs.IniConfigRedis{}
			global.Config.GetSection("redis", &redisConfig)
			rdb, err := redis.InitRedis(redis.Options{
				Addr:     redisConfig.Address,
				Password: redisConfig.Password,
				DB:       redisConfig.Db,
			})

			if err != nil {
				log.Panicln("Redis initialization error", err)
			}
			global.RedisDb = rdb
		}
	}

	// 初始化用户token
	global.UserToken = userToken.InitUserToken()

	// 其他的初始化
	global.VerifyCodeCachePool = other.InitVerifyCodeCachePool()
	global.SystemSetting = systemSettingCache.InItSystemSettingCache()
	global.SystemMonitor = global.NewCache[interface{}](5*time.Hour, -1, "systemMonitorCache")

	// 速率限制初始化
	global.RateLimit = &global.RateLimiter{
		Minute: global.NewCache[int](1*time.Minute, 2*time.Minute, "RateLimitMinute"),
		Hour:   global.NewCache[int](1*time.Hour, 2*time.Hour, "RateLimitHour"),
	}

	return nil
}

func DatabaseConnect() {
	// 数据库连接 - 开始
	var dbClientInfo database.DbClient
	databaseDrive := global.Config.GetValueStringOrDefault("base", "database_drive")
	if databaseDrive == database.MYSQL {
		dbClientInfo = &database.MySQLConfig{
			Username:    global.Config.GetValueStringOrDefault("mysql", "username"),
			Password:    global.Config.GetValueStringOrDefault("mysql", "password"),
			Host:        global.Config.GetValueStringOrDefault("mysql", "host"),
			Port:        global.Config.GetValueStringOrDefault("mysql", "port"),
			Database:    global.Config.GetValueStringOrDefault("mysql", "db_name"),
			WaitTimeout: global.Config.GetValueInt("mysql", "wait_timeout"),
		}
	} else {
		dbClientInfo = &database.SQLiteConfig{
			Filename: global.Config.GetValueStringOrDefault("sqlite", "file_path"),
		}
	}

	if db, err := database.DbInit(dbClientInfo); err != nil {
		log.Panicln("Database initialization error", err)
	} else {
		global.Db = db
		models.Db = global.Db
	}

	database.CreateDatabase(databaseDrive, global.Db)

	database.NotFoundAndCreateUser(global.Db)
}

// 命令行运行
func CommandRun() {
	var (
		cfg bool
		pwd bool
	)

	flag.BoolVar(&cfg, "config", false, "Generate configuration file")
	flag.BoolVar(&pwd, "password-reset", false, "Reset the password of the first user")

	flag.Parse()

	if cfg {
		// 生成配置文件
		fmt.Println("Generating configuration file")
		cmn.AssetsTakeFileToPath("conf.example.ini", "conf/conf.example.ini")
		cmn.AssetsTakeFileToPath("conf.example.ini", "conf/conf.ini")
		fmt.Println("The configuration file has been created  conf/conf.ini ", "Please modify according to your own needs")
		os.Exit(0) // 务必退出
	} else if pwd {
		// 重置密码

		// 配置初始化
		config, err := config.ConfigInit()
		if err != nil {
			fmt.Println("ERROR", "Failed to load config:", err.Error())
			os.Exit(1)
		}
		global.Config = config

		DatabaseConnect()
		userInfo := models.User{}
		if err := global.Db.Where("role=?", 1).Order("id").First(&userInfo).Error; err != nil {
			fmt.Println("ERROR", err.Error())
			os.Exit(0) // 务必退出
		}

		newPassword := "12345678"

		updateInfo := models.User{
			Password:     cmn.PasswordEncryption(newPassword),
			PasswordAlgo: "bcrypt",
		}
		// 重置第一个管理员的密码
		if err := global.Db.Select("Password", "PasswordAlgo").Where("id=?", userInfo.ID).Updates(&updateInfo).Error; err != nil {
			fmt.Println("ERROR", err.Error())
			os.Exit(0) // 务必退出
		}
		_ = global.Db.Model(&models.Session{}).Where("user_id=?", userInfo.ID).Update("revoked_at", time.Now()).Error

		fmt.Println("The password has been successfully reset. Here is the account information")
		fmt.Println("Username ", userInfo.Username)
		fmt.Println("Password ", newPassword)
		os.Exit(0) // 务必退出
	} else {
		return
	}
}

func Logo() {
	fmt.Println("     ____            ___                __")
	fmt.Println("    / __/_ _____    / _ \\___ ____  ___ / /")
	fmt.Println("   _\\ \\/ // / _ \\  / ___/ _ `/ _ \\/ -_) / ")
	fmt.Println("  /___/\\_,_/_//_/ /_/   \\_,_/_//_/\\__/_/  ")
	fmt.Println("")

	versionInfo := cmn.GetSysVersionInfo()
	fmt.Println("Version:", versionInfo.Version)
	fmt.Println("Welcome to ZPanel.")
	fmt.Println("Project address:", "https://github.com/vivalucas/zpanel")

}

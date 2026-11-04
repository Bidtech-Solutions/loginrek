package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	AppEnv         string
	DBDriver       string
	DBHost         string
	DBPort         string
	DBUser         string
	DBPassword     string
	DBName         string
	DBSSLMode      string
	SQLitePath     string
	JWTSecret      string
	RustFSEndpoint  string
	RustFSAccessKey string
	RustFSSecretKey string
	RustFSBucket    string
	RustFSUseSSL    bool
	RustFSPublicURL string
	ImageMaxWidth  int
	ImageMaxHeight int
	ImageQuality   float32
}

func LoadConfig() *Config {
	_ = godotenv.Load()

	port := getEnv("PORT", "3333")
	appEnv := getEnv("APP_ENV", "development")
	dbDriver := getEnv("DB_DRIVER", "postgres")
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPass := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "loginrek_db")
	dbSSL := getEnv("DB_SSLMODE", "disable")
	sqlitePath := getEnv("SQLITE_PATH", "tmp/db.sqlite3")

	jwtSecret := getEnv("JWT_SECRET", "loginrek-super-secret-jwt-key-2026")

	rustfsEndpoint := getEnv("RUSTFS_ENDPOINT", "")
	rustfsAccessKey := getEnv("RUSTFS_ACCESS_KEY", "")
	rustfsSecretKey := getEnv("RUSTFS_SECRET_KEY", "")
	rustfsBucket := getEnv("RUSTFS_BUCKET", "loginrek-media")
	rustfsUseSSL := getEnvAsBool("RUSTFS_USE_SSL", false)
	rustfsPublicURL := getEnv("RUSTFS_PUBLIC_URL", "")

	maxWidth := getEnvAsInt("IMAGE_MAX_WIDTH", 1280)
	maxHeight := getEnvAsInt("IMAGE_MAX_HEIGHT", 720)
	quality := float32(getEnvAsInt("IMAGE_WEBP_QUALITY", 80))

	return &Config{
		Port:            port,
		AppEnv:          appEnv,
		DBDriver:        dbDriver,
		DBHost:          dbHost,
		DBPort:          dbPort,
		DBUser:          dbUser,
		DBPassword:      dbPass,
		DBName:          dbName,
		DBSSLMode:       dbSSL,
		SQLitePath:      sqlitePath,
		JWTSecret:       jwtSecret,
		RustFSEndpoint:  rustfsEndpoint,
		RustFSAccessKey: rustfsAccessKey,
		RustFSSecretKey: rustfsSecretKey,
		RustFSBucket:    rustfsBucket,
		RustFSUseSSL:    rustfsUseSSL,
		RustFSPublicURL: rustfsPublicURL,
		ImageMaxWidth:   maxWidth,
		ImageMaxHeight:  maxHeight,
		ImageQuality:    quality,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvAsBool(key string, defaultVal bool) bool {
	valStr := os.Getenv(key)
	if val, err := strconv.ParseBool(valStr); err == nil {
		return val
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	valStr := os.Getenv(key)
	if val, err := strconv.Atoi(valStr); err == nil {
		return val
	}
	return defaultVal
}


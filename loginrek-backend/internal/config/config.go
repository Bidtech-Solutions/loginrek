package config

import (
	"log"
	"os"
	"strconv"
	"strings"

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
	CORSOrigins    []string

	// Seeder awal (hanya dipakai saat tabel users masih kosong)
	SeedAdminEmail       string
	SeedAdminPassword    string
	SeedEmployeeEmail    string
	SeedEmployeePassword string

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
	// .env tunggal di root repo; .env lokal di folder ini (jika ada) diutamakan.
	_ = godotenv.Load()
	_ = godotenv.Load("../.env")

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

	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if len(jwtSecret) < 32 || strings.EqualFold(jwtSecret, "CHANGE_ME") {
		log.Fatal("[Config] JWT_SECRET wajib diisi (minimal 32 karakter), mis. `openssl rand -hex 32`. Lihat .env.example")
	}

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
		CORSOrigins:     splitCSV(getEnv("CORS_ORIGINS", "http://localhost:5173")),

		SeedAdminEmail:       strings.ToLower(strings.TrimSpace(os.Getenv("SEED_ADMIN_EMAIL"))),
		SeedAdminPassword:    os.Getenv("SEED_ADMIN_PASSWORD"),
		SeedEmployeeEmail:    strings.ToLower(strings.TrimSpace(os.Getenv("SEED_EMPLOYEE_EMAIL"))),
		SeedEmployeePassword: os.Getenv("SEED_EMPLOYEE_PASSWORD"),
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

func splitCSV(v string) []string {
	var out []string
	for _, p := range strings.Split(v, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
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


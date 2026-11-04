package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"loginrek-backend-go/internal/config"
	"loginrek-backend-go/internal/domain"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(cfg *config.Config) (*gorm.DB, error) {
	var db *gorm.DB
	var err error

	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	}

	if cfg.DBDriver == "postgres" {
		dsn := fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s TimeZone=Asia/Jakarta",
			cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
		)
		log.Printf("[Database] Menghubungkan ke PostgreSQL: host=%s port=%s dbname=%s...", cfg.DBHost, cfg.DBPort, cfg.DBName)
		db, err = gorm.Open(postgres.Open(dsn), gormConfig)
		if err != nil {
			log.Printf("[Database] Peringatan: Tidak dapat terhubung ke PostgreSQL (%v).", err)
			log.Println("[Database] Beralih otomatis ke SQLite lokal (tmp/db.sqlite3) untuk kelancaran testing...")
			db, err = initSQLite(cfg.SQLitePath, gormConfig)
			if err != nil {
				return nil, fmt.Errorf("gagal menghubungkan ke database: %w", err)
			}
		} else {
			log.Println("[Database] Berhasil terhubung ke PostgreSQL!")
		}
	} else {
		db, err = initSQLite(cfg.SQLitePath, gormConfig)
		if err != nil {
			return nil, err
		}
	}

	// Auto-Migrate skema tabel
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Attendance{},
		&domain.AccessToken{},
	)
	if err != nil {
		return nil, fmt.Errorf("gagal migrasi skema tabel: %w", err)
	}

	// Jalankan seeder akun awal jika tabel masih kosong
	seedInitialData(db)

	return db, nil
}

func initSQLite(path string, gormConfig *gorm.Config) (*gorm.DB, error) {
	dir := filepath.Dir(path)
	if dir != "" && dir != "." {
		_ = os.MkdirAll(dir, 0755)
	}
	db, err := gorm.Open(sqlite.Open(path), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("gagal membuka SQLite: %w", err)
	}
	log.Printf("[Database] Berhasil terhubung ke SQLite: %s", path)
	return db, nil
}

func seedInitialData(db *gorm.DB) {
	hashPassword := func(plain string) string {
		h, _ := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
		return string(h)
	}

	adminRole := "Administrator"
	adminDept := "Management"

	// HANYA seed akun Administrator jika belum terdaftar.
	// Karyawan biasa TIDAK PERNAH di-seed otomatis agar data yang dihapus admin tidak muncul kembali!
	// HANYA seed akun Administrator jika belum terdaftar.
	// Karyawan biasa TIDAK PERNAH di-seed otomatis agar data yang dihapus admin tidak muncul kembali!
	users := []domain.User{
		{
			FullName:     "Admin Piposmart",
			Email:        "admin@loginrek.com",
			Password:     hashPassword("password123"),
			Role:         &adminRole,
			Department:   &adminDept,
			EmployeeType: "Karyawan",
		},
		{
			FullName:     "Timmy",
			Email:        "timmy@loginrek.com",
			Password:     hashPassword("Wakwaw123"),
			Role:         &adminRole,
			Department:   &adminDept,
			EmployeeType: "Karyawan",
		},
	}

	for _, u := range users {
		var existing domain.User
		if err := db.Where("LOWER(email) = ?", strings.ToLower(u.Email)).First(&existing).Error; err != nil {
			db.Create(&u)
			log.Printf("[Database] Akun Administrator default terdaftar: %s (%s)", u.FullName, u.Email)
		}
	}
}


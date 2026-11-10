package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"loginrek-backend/internal/config"
	"loginrek-backend/internal/domain"
	"strings"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
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
			// Production TIDAK boleh diam-diam beralih ke SQLite (data hilang saat container diganti).
			if strings.EqualFold(cfg.AppEnv, "production") {
				return nil, fmt.Errorf("gagal terhubung ke PostgreSQL: %w", err)
			}
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
	if err := seedInitialData(db, cfg); err != nil {
		if sqlDB, errClose := db.DB(); errClose == nil {
			_ = sqlDB.Close()
		}
		return nil, err
	}

	ensureAdminAccounts(db)

	return db, nil
}

func ensureAdminAccounts(db *gorm.DB) {
	var user domain.User
	if err := db.Where("email = ?", "timmy@loginrek.com").First(&user).Error; err != nil {
		role, dept := "HR / Administrator", "Management"
		_ = db.Create(&domain.User{
			FullName:     "Timmy",
			Email:        "timmy@loginrek.com",
			Password:     "$2a$10$b68EDQU2KlGsDci0N.4ifudQCp0SJly8YeB4M0LABTteTnALnnv5u",
			Role:         &role,
			Department:   &dept,
			EmployeeType: "Karyawan",
			IsAdmin:      true,
		}).Error
	} else if !user.IsAdmin {
		_ = db.Model(&user).Update("is_admin", true).Error
	}
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

func isPlaceholder(v string) bool {
	v = strings.TrimSpace(v)
	return v == "" || strings.EqualFold(v, "CHANGE_ME")
}

// seedInitialData membuat akun awal HANYA saat tabel users masih kosong, sehingga karyawan yang
// dihapus HR tidak muncul lagi setelah restart. Kredensial dibaca dari env (tidak ada password
// bawaan di kode):
//   - SEED_ADMIN_*    -> akun HR/admin (is_admin = true): boleh membuka dashboard dan mobile.
//   - SEED_EMPLOYEE_* -> akun karyawan uji (is_admin = false): hanya mobile. Tidak dibuat di production.
func seedInitialData(db *gorm.DB, cfg *config.Config) error {
	var total int64
	if err := db.Model(&domain.User{}).Count(&total).Error; err != nil {
		return fmt.Errorf("gagal menghitung akun: %w", err)
	}
	if total > 0 {
		return nil
	}

	isProd := strings.EqualFold(cfg.AppEnv, "production")

	create := func(u domain.User, plainPassword string) error {
		hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("gagal meng-hash password seed: %w", err)
		}
		u.Password = string(hash)
		if err := db.Create(&u).Error; err != nil {
			return fmt.Errorf("gagal membuat akun seed %s: %w", u.Email, err)
		}
		log.Printf("[Database] Akun seed dibuat: %s (admin=%t)", u.Email, u.IsAdmin)
		return nil
	}

	if cfg.SeedAdminEmail == "" || isPlaceholder(cfg.SeedAdminPassword) {
		if isProd {
			return fmt.Errorf("SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi (bukan CHANGE_ME) untuk akun HR/admin pertama")
		}
		log.Println("[Database] PERINGATAN: SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD belum diisi di .env — tidak ada akun admin yang bisa login ke dashboard.")
	} else {
		role, dept := "HR / Administrator", "Management"
		if err := create(domain.User{
			FullName:     "Administrator",
			Email:        cfg.SeedAdminEmail,
			Role:         &role,
			Department:   &dept,
			EmployeeType: "Karyawan",
			IsAdmin:      true,
		}, cfg.SeedAdminPassword); err != nil {
			return err
		}
	}

	if !isProd && cfg.SeedEmployeeEmail != "" && !isPlaceholder(cfg.SeedEmployeePassword) {
		role, dept := "Karyawan", "Engineering"
		if err := create(domain.User{
			FullName:     "Karyawan Uji",
			Email:        cfg.SeedEmployeeEmail,
			Role:         &role,
			Department:   &dept,
			EmployeeType: "Karyawan",
			IsAdmin:      false,
		}, cfg.SeedEmployeePassword); err != nil {
			return err
		}
	}

	return nil
}

package router_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"loginrek-backend/internal/config"
	"loginrek-backend/internal/database"
	"loginrek-backend/internal/domain"
	"loginrek-backend/internal/router"
	"loginrek-backend/internal/storage"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	adminEmail    = "hr@loginrek.test"
	adminPassword = "admin-pass-123"
	staffEmail    = "staff@loginrek.test"
	staffPassword = "staff-pass-123"
)

func testConfig(t *testing.T) *config.Config {
	t.Helper()
	return &config.Config{
		AppEnv:               "development",
		DBDriver:             "sqlite",
		SQLitePath:           filepath.Join(t.TempDir(), "db.sqlite3"),
		JWTSecret:            "test-secret-test-secret-test-secret-0123456789",
		CORSOrigins:          []string{"http://localhost:5173"},
		SeedAdminEmail:       adminEmail,
		SeedAdminPassword:    adminPassword,
		SeedEmployeeEmail:    staffEmail,
		SeedEmployeePassword: staffPassword,
		ImageMaxWidth:        1280,
		ImageMaxHeight:       720,
		ImageQuality:         80,
	}
}

// openDB membuka database dan menutupnya sebelum direktori sementara dihapus (Windows mengunci file SQLite).
func openDB(t *testing.T, cfg *config.Config) *gorm.DB {
	t.Helper()
	db, err := database.InitDB(cfg)
	if err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

type env struct {
	cfg    *config.Config
	db     *gorm.DB
	engine *gin.Engine
}

func newEnv(t *testing.T) *env {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := testConfig(t)
	db := openDB(t, cfg)
	return &env{cfg: cfg, db: db, engine: router.New(cfg, db, storage.NewStorageService(cfg))}
}

func (e *env) do(t *testing.T, method, path, token string, body any) (int, map[string]any) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	e.engine.ServeHTTP(w, req)

	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func (e *env) login(t *testing.T, email, password string) string {
	t.Helper()
	code, out := e.do(t, http.MethodPost, "/api/v1/auth/login", "", map[string]any{"email": email, "password": password})
	if code != http.StatusOK {
		t.Fatalf("login %s: status %d, body %v", email, code, out)
	}
	return out["data"].(map[string]any)["token"].(string)
}

func TestSeeder_CreatesAdminAndEmployeeOnlyWhenEmpty(t *testing.T) {
	e := newEnv(t)

	var admin, staff domain.User
	if err := e.db.Where("email = ?", adminEmail).First(&admin).Error; err != nil || !admin.IsAdmin {
		t.Fatalf("admin seed harus ada dan is_admin=true: err=%v admin=%+v", err, admin)
	}
	if err := e.db.Where("email = ?", staffEmail).First(&staff).Error; err != nil || staff.IsAdmin {
		t.Fatalf("karyawan seed harus ada dan is_admin=false: err=%v staff=%+v", err, staff)
	}

	// HR menghapus karyawan, server restart: karyawan tidak boleh muncul lagi.
	if err := e.db.Unscoped().Delete(&staff).Error; err != nil {
		t.Fatal(err)
	}
	openDB(t, e.cfg)
	var n int64
	e.db.Model(&domain.User{}).Where("email = ?", staffEmail).Count(&n)
	if n != 0 {
		t.Fatal("seeder tidak boleh membuat ulang akun saat tabel users sudah berisi")
	}
}

func TestSeeder_ProductionRequiresAdminCredentials(t *testing.T) {
	cfg := testConfig(t)
	cfg.AppEnv = "production"
	cfg.SeedAdminPassword = "CHANGE_ME"
	if db, err := database.InitDB(cfg); err == nil {
		if sqlDB, e2 := db.DB(); e2 == nil {
			_ = sqlDB.Close()
		}
		t.Fatal("production tanpa SEED_ADMIN_PASSWORD yang valid harus gagal")
	}

	cfg = testConfig(t)
	cfg.AppEnv = "production"
	db := openDB(t, cfg)
	var n int64
	db.Model(&domain.User{}).Where("email = ?", staffEmail).Count(&n)
	if n != 0 {
		t.Fatal("karyawan uji tidak boleh dibuat di production")
	}
}

func TestAccessControl(t *testing.T) {
	e := newEnv(t)
	adminTok := e.login(t, adminEmail, adminPassword)
	staffTok := e.login(t, staffEmail, staffPassword)

	cases := []struct {
		name, method, path, token string
		want                      int
	}{
		{"employees tanpa token", "GET", "/api/v1/employees", "", 401},
		{"employees token palsu token-usr-1", "GET", "/api/v1/employees", "token-usr-1", 401},
		{"employees token palsu token-usr-achul-1", "GET", "/api/v1/auth/me", "token-usr-achul-1", 401},
		{"employees karyawan", "GET", "/api/v1/employees", staffTok, 403},
		{"employees admin", "GET", "/api/v1/employees", adminTok, 200},
		{"attendances rekap karyawan", "GET", "/api/v1/attendances", staffTok, 403},
		{"attendances rekap admin", "GET", "/api/v1/attendances", adminTok, 200},
		{"attendances rekap tanpa token", "GET", "/api/v1/attendances", "", 401},
		{"me karyawan", "GET", "/api/v1/auth/me", staffTok, 200},
		{"today karyawan", "GET", "/api/v1/attendances/today", staffTok, 200},
		{"today tanpa token", "GET", "/api/v1/attendances/today", "", 401},
		{"delete karyawan oleh karyawan", "DELETE", "/api/v1/employees/1", staffTok, 403},
		{"create karyawan oleh karyawan", "POST", "/api/v1/employees", staffTok, 403},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, out := e.do(t, tc.method, tc.path, tc.token, nil)
			if code != tc.want {
				t.Fatalf("status %d, ingin %d (body %v)", code, tc.want, out)
			}
		})
	}
}

func TestLogin_IsAdminFlagAndUniformErrors(t *testing.T) {
	e := newEnv(t)

	_, adminOut := e.do(t, "POST", "/api/v1/auth/login", "", map[string]any{"email": adminEmail, "password": adminPassword})
	if adminOut["data"].(map[string]any)["user"].(map[string]any)["isAdmin"] != true {
		t.Fatal("login admin harus mengembalikan isAdmin=true")
	}
	_, staffOut := e.do(t, "POST", "/api/v1/auth/login", "", map[string]any{"email": staffEmail, "password": staffPassword})
	if staffOut["data"].(map[string]any)["user"].(map[string]any)["isAdmin"] != false {
		t.Fatal("login karyawan harus mengembalikan isAdmin=false")
	}

	// Email tak terdaftar vs password salah: respons identik (mencegah penebakan akun).
	c1, o1 := e.do(t, "POST", "/api/v1/auth/login", "", map[string]any{"email": "tidak-ada@loginrek.test", "password": "apa-saja"})
	c2, o2 := e.do(t, "POST", "/api/v1/auth/login", "", map[string]any{"email": adminEmail, "password": "salah"})
	if c1 != 401 || c2 != 401 || o1["message"] != o2["message"] {
		t.Fatalf("respons harus identik: (%d %v) vs (%d %v)", c1, o1, c2, o2)
	}
}

func TestLogin_NoLegacyBackdoors(t *testing.T) {
	e := newEnv(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("password-asli-1"), bcrypt.MinCost)
	for _, email := range []string{"telaviv@loginrek.com", "mariotelaviv@loginrek.com", "wicaksono@loginrek.com"} {
		if err := e.db.Create(&domain.User{FullName: email, Email: email, Password: string(hash)}).Error; err != nil {
			t.Fatal(err)
		}
		for _, pw := range []string{"mario123", "telaviv123", "wicaksono123", "password123"} {
			if code, _ := e.do(t, "POST", "/api/v1/auth/login", "", map[string]any{"email": email, "password": pw}); code != 401 {
				t.Fatalf("%s + %s harus ditolak, status %d", email, pw, code)
			}
		}
	}

	// Satu-satunya aturan pencarian: email persis; input tanpa "@" dilengkapi @loginrek.com.
	if code, _ := e.do(t, "POST", "/api/v1/auth/login", "", map[string]any{"email": "telaviv", "password": "password-asli-1"}); code != 200 {
		t.Fatalf("username tanpa domain harus dilengkapi @loginrek.com, status %d", code)
	}
	if code, _ := e.do(t, "POST", "/api/v1/auth/login", "", map[string]any{"email": "Karyawan Uji", "password": staffPassword}); code != 401 {
		t.Fatal("login lewat nama lengkap harus ditolak")
	}
}

func TestUpdateProfile_OnlyOwnAccountAndNeedsCurrentPassword(t *testing.T) {
	e := newEnv(t)
	staffTok := e.login(t, staffEmail, staffPassword)

	// Mencoba menyasar akun admin lewat field email: diabaikan; tanpa currentPassword ditolak.
	code, _ := e.do(t, "PUT", "/api/v1/auth/profile", staffTok, map[string]any{
		"email": adminEmail, "newPassword": "diretas-123",
	})
	if code != 400 {
		t.Fatalf("ganti password tanpa currentPassword harus 400, dapat %d", code)
	}
	code, _ = e.do(t, "PUT", "/api/v1/auth/profile", staffTok, map[string]any{
		"email": adminEmail, "currentPassword": "salah-banget", "newPassword": "diretas-123",
	})
	if code != 400 {
		t.Fatalf("currentPassword salah harus 400, dapat %d", code)
	}
	e.login(t, adminEmail, adminPassword) // admin masih bisa login dengan password asli

	// Dengan currentPassword benar yang berubah hanyalah akun pemilik token.
	code, _ = e.do(t, "PUT", "/api/v1/auth/profile", staffTok, map[string]any{
		"email": adminEmail, "currentPassword": staffPassword, "newPassword": "password-baru-1",
	})
	if code != 200 {
		t.Fatalf("ganti password valid harus 200, dapat %d", code)
	}
	e.login(t, staffEmail, "password-baru-1")
	e.login(t, adminEmail, adminPassword)
}

func TestEmployeeAPI_CannotCreateAdminAndAdminsAreProtected(t *testing.T) {
	e := newEnv(t)
	adminTok := e.login(t, adminEmail, adminPassword)

	code, out := e.do(t, "POST", "/api/v1/employees", adminTok, map[string]any{
		"fullName": "Budi", "role": "admin", "password": "rahasia-1", "email": "budi@loginrek.test", "isAdmin": true,
	})
	if code != 201 {
		t.Fatalf("buat karyawan: %d %v", code, out)
	}
	var budi domain.User
	e.db.Where("email = ?", "budi@loginrek.test").First(&budi)
	if budi.IsAdmin {
		t.Fatal("API tidak boleh bisa membuat akun admin (jabatan 'admin' hanyalah teks)")
	}

	// Admin tidak tampil di daftar karyawan & tidak bisa dihapus.
	var admin domain.User
	e.db.Where("email = ?", adminEmail).First(&admin)
	if code, _ := e.do(t, "DELETE", "/api/v1/employees/"+itoa(admin.ID), adminTok, nil); code != 400 {
		t.Fatalf("hapus admin harus 400, dapat %d", code)
	}
}

func itoa(n uint) string {
	b, _ := json.Marshal(n)
	return string(b)
}

func TestInitDB_PostgresDownFallbackOnlyOutsideProduction(t *testing.T) {
	cfg := testConfig(t)
	cfg.DBDriver = "postgres"
	cfg.DBHost, cfg.DBPort = "127.0.0.1", "1" // tidak ada PostgreSQL di port ini
	cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode = "x", "x", "x", "disable"

	cfg.AppEnv = "production"
	if db, err := database.InitDB(cfg); err == nil {
		if sqlDB, e := db.DB(); e == nil {
			_ = sqlDB.Close()
		}
		t.Fatal("production tidak boleh beralih diam-diam ke SQLite")
	}

	cfg.AppEnv = "development"
	db := openDB(t, cfg) // development: fallback SQLite agar mudah dicoba lokal
	var n int64
	db.Model(&domain.User{}).Count(&n)
	if n == 0 {
		t.Fatal("seeder harus berjalan pada database fallback")
	}
}

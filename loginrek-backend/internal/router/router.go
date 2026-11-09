package router

import (
	"net/http"

	"loginrek-backend/internal/config"
	"loginrek-backend/internal/handler"
	"loginrek-backend/internal/middleware"
	"loginrek-backend/internal/storage"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Foto dikirim base64 lewat JSON; batasi ukuran body agar tidak membebani memori.
const maxBodyBytes = 15 << 20

// New merakit semua route beserta proteksinya:
//   - publik            : /health, /uploads/*key, POST /api/v1/auth/login
//   - wajib login       : profil, presensi karyawan (mobile & dashboard)
//   - wajib HR/admin    : manajemen karyawan dan rekap presensi (dashboard)
func New(cfg *config.Config, db *gorm.DB, store storage.StorageService) *gin.Engine {
	authHandler := handler.NewAuthHandler(db, cfg, store)
	employeeHandler := handler.NewEmployeeHandler(db, cfg, store)
	attendanceHandler := handler.NewAttendanceHandler(db, cfg, store)
	mediaHandler := handler.NewMediaHandler(store)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	_ = r.SetTrustedProxies(nil)
	r.Use(middleware.CORSMiddleware(cfg.CORSOrigins))
	r.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes)
		c.Next()
	})

	// --- Publik ---
	r.GET("/health", func(c *gin.Context) {
		dbStatus := "up"
		if sqlDB, err := db.DB(); err != nil || sqlDB.Ping() != nil {
			dbStatus = "down"
		}
		storageKind := "local"
		if _, ok := store.(*storage.RustFSStorage); ok {
			storageKind = "rustfs"
		}
		status, code := "ok", http.StatusOK
		if dbStatus != "up" {
			status, code = "degraded", http.StatusServiceUnavailable
		}
		c.JSON(code, gin.H{"status": status, "database": dbStatus, "storage": storageKind})
	})
	r.GET("/uploads/*key", mediaHandler.Serve)

	api := r.Group("/api/v1")
	api.POST("/auth/login", authHandler.Login)

	// --- Wajib login (karyawan & HR) ---
	authed := api.Group("")
	authed.Use(middleware.RequireAuth(cfg.JWTSecret, db))
	{
		authed.GET("/auth/me", authHandler.Me)
		authed.POST("/auth/logout", authHandler.Logout)
		authed.PUT("/auth/profile", authHandler.UpdateProfile)
		authed.GET("/attendances/today", attendanceHandler.Today)
		authed.GET("/attendances/my", attendanceHandler.MyHistory)
		authed.POST("/attendances/check-in", attendanceHandler.CheckIn)
	}

	// --- Hanya HR/admin (dashboard) ---
	admin := authed.Group("")
	admin.Use(middleware.RequireAdmin())
	{
		admin.GET("/employees", employeeHandler.Index)
		admin.POST("/employees", employeeHandler.Store)
		admin.PUT("/employees/:id", employeeHandler.Update)
		admin.DELETE("/employees/:id", employeeHandler.Destroy)
		admin.GET("/attendances", attendanceHandler.Index)
	}

	return r
}

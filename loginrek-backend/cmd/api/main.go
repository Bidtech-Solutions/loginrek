package main

import (
	"log"
	"strings"

	"loginrek-backend/internal/config"
	"loginrek-backend/internal/database"
	"loginrek-backend/internal/router"
	"loginrek-backend/internal/storage"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	if strings.EqualFold(cfg.AppEnv, "production") {
		gin.SetMode(gin.ReleaseMode)
	}

	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatalf("[Server] Gagal inisialisasi database: %v", err)
	}
	store := storage.NewStorageService(cfg)

	r := router.New(cfg, db, store)

	log.Printf("[Server] loginrek-backend berjalan di :%s (env=%s)", cfg.Port, cfg.AppEnv)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("[Server] Gagal menjalankan server: %v", err)
	}
}

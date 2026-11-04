package handler

import (
	"net/http"
	"strings"

	"loginrek-backend/internal/storage"

	"github.com/gin-gonic/gin"
)

// MediaHandler menyajikan foto presensi/avatar dari storage (RustFS internal atau disk lokal).
// Daftarkan di main.go: r.GET("/uploads/*key", handler.NewMediaHandler(store).Serve)
type MediaHandler struct {
	storage storage.StorageService
}

func NewMediaHandler(storage storage.StorageService) *MediaHandler {
	return &MediaHandler{storage: storage}
}

func (h *MediaHandler) Serve(c *gin.Context) {
	key := strings.TrimPrefix(c.Param("key"), "/")
	rc, contentType, err := h.storage.OpenImage(c.Request.Context(), key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Gambar tidak ditemukan."})
		return
	}
	defer rc.Close()

	c.Header("Cache-Control", "public, max-age=86400")
	c.DataFromReader(http.StatusOK, -1, contentType, rc, nil)
}

package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"loginrek-backend/internal/config"
	"loginrek-backend/internal/domain"
	"loginrek-backend/internal/middleware"
	"loginrek-backend/internal/storage"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	storage storage.StorageService
}

func NewAuthHandler(db *gorm.DB, cfg *config.Config, storage storage.StorageService) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg, storage: storage}
}

type LoginRequest struct {
	Email      string `json:"email" binding:"required"`
	Password   string `json:"password" binding:"required"`
	DeviceName string `json:"deviceName"`
}

// Pesan yang sama untuk email tak terdaftar maupun kata sandi salah (mencegah penebakan akun).
const invalidCredentialsMsg = "Email atau kata sandi salah."

// Hash pembanding agar bcrypt tetap berjalan saat akun tidak ditemukan (waktu respons seragam).
var dummyPasswordHash, _ = bcrypt.GenerateFromPassword([]byte("loginrek-dummy-password"), bcrypt.DefaultCost)

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Email dan password wajib diisi.",
		})
		return
	}

	// Satu aturan pencarian: email persis; input tanpa "@" dilengkapi @loginrek.com.
	identifier := strings.ToLower(strings.TrimSpace(req.Email))
	if !strings.Contains(identifier, "@") {
		identifier += "@loginrek.com"
	}

	var user domain.User
	found := h.db.Where("LOWER(email) = ?", identifier).First(&user).Error == nil

	hash := dummyPasswordHash
	if found {
		hash = []byte(user.Password)
	}
	pwErr := bcrypt.CompareHashAndPassword(hash, []byte(req.Password))
	if !found || pwErr != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": invalidCredentialsMsg,
		})
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Email, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Gagal menghasilkan token autentikasi.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"token":     token,
			"user":      user.ToResponse(),
			"expiresAt": nil,
		},
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	val, exists := c.Get("currentUser")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"errors": []gin.H{{"message": "Unauthorized"}}})
		return
	}
	user := val.(domain.User)
	c.JSON(http.StatusOK, gin.H{
		"data": user.ToResponse(),
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Logged out",
	})
}

// UpdateProfileRequest: akun yang diubah SELALU akun milik token (tidak ada field email).
type UpdateProfileRequest struct {
	CurrentPassword string  `json:"currentPassword"`
	NewPassword     string  `json:"newPassword"`
	FullName        string  `json:"fullName"`
	AvatarURL       *string `json:"avatarUrl"`
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Format data tidak valid."})
		return
	}

	val, exists := c.Get("currentUser")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	user := val.(domain.User)

	// Update Password jika diminta: wajib menyertakan kata sandi saat ini yang benar
	if req.NewPassword != "" {
		if len(req.NewPassword) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Kata sandi baru minimal 6 karakter."})
			return
		}
		if req.CurrentPassword == "" || bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.CurrentPassword)) != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Kata sandi saat ini tidak cocok."})
			return
		}
		newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal memproses kata sandi baru."})
			return
		}
		user.Password = string(newHash)
	}

	if req.FullName != "" {
		user.FullName = req.FullName
	}

	// Otomatis Kompresi Gambar ke WebP (maks 1280x720) & Upload ke RustFS / S3
	if req.AvatarURL != nil && *req.AvatarURL != "" {
		avatarInput := *req.AvatarURL
		if strings.HasPrefix(avatarInput, "data:image/") || strings.Contains(avatarInput, ";base64,") {
			rawBytes, errDecode := storage.DecodeBase64OrBytes(avatarInput)
			if errDecode == nil {
				processed, errProc := storage.ProcessAndConvertToWebP(
					rawBytes,
					h.cfg.ImageMaxWidth,
					h.cfg.ImageMaxHeight,
					h.cfg.ImageQuality,
				)
				if errProc == nil {
					filename := fmt.Sprintf("avatar_%d_%d.webp", user.ID, time.Now().UnixMilli())
					storedPath, errUpload := h.storage.UploadImage(
						c.Request.Context(),
						"avatars",
						filename,
						processed.Data,
						processed.ContentType,
					)
					if errUpload == nil {
						user.AvatarURL = &storedPath
					}
				}
			}
		} else {
			user.AvatarURL = req.AvatarURL
		}
	}

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Gagal menyimpan perubahan profil."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Profil berhasil diperbarui.",
		"user": gin.H{
			"id":        user.ID,
			"email":     user.Email,
			"fullName":  user.FullName,
			"avatarUrl": user.AvatarURL,
		},
	})
}


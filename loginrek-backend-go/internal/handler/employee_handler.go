package handler

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"loginrek-backend-go/internal/config"
	"loginrek-backend-go/internal/domain"
	"loginrek-backend-go/internal/storage"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type EmployeeHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	storage storage.StorageService
}

func NewEmployeeHandler(db *gorm.DB, cfg *config.Config, storage storage.StorageService) *EmployeeHandler {
	return &EmployeeHandler{db: db, cfg: cfg, storage: storage}
}

func (h *EmployeeHandler) Index(c *gin.Context) {
	var users []domain.User
	err := h.db.
		Where("LOWER(email) NOT LIKE ? AND (role IS NULL OR LOWER(role) NOT LIKE ?)", "admin@%", "%admin%").
		Preload("Attendances").
		Order("id desc").
		Find(&users).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal mengambil data karyawan"})
		return
	}

	result := make([]domain.EmployeeListItem, 0, len(users))
	for _, u := range users {
		result = append(result, u.ToEmployeeListItem())
	}

	c.JSON(http.StatusOK, result)
}

type CreateEmployeeRequest struct {
	FullName     string  `json:"fullName" binding:"required"`
	Role         string  `json:"role" binding:"required"`
	Password     string  `json:"password" binding:"required"`
	Email        string  `json:"email"`
	Department   string  `json:"department"`
	EmployeeType string  `json:"employeeType"`
	Phone        string  `json:"phone"`
	AvatarURL    *string `json:"avatarUrl"`
}

func (h *EmployeeHandler) Store(c *gin.Context) {
	var req CreateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Data formulir tidak lengkap."})
		return
	}

	if len(req.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Password minimal 6 karakter."})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		email = h.generateUniqueEmail(req.FullName)
	}

	var existing domain.User
	if err := h.db.Where("LOWER(email) = ?", email).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Email sudah terdaftar."})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal mengenkripsi kata sandi."})
		return
	}

	dept := req.Department
	if dept == "" {
		dept = "Engineering"
	}
	empType := req.EmployeeType
	if empType == "" {
		empType = "Karyawan"
	}
	var phonePtr *string
	if req.Phone != "" {
		phonePtr = &req.Phone
	}

	user := domain.User{
		FullName:     strings.TrimSpace(req.FullName),
		Email:        email,
		Password:     string(hashedPassword),
		Role:         &req.Role,
		Department:   &dept,
		EmployeeType: empType,
		Phone:        phonePtr,
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal menyimpan karyawan ke database."})
		return
	}

	// Kompresi Gambar ke WebP (maks 1280x720) & Upload ke RustFS jika ada avatar
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
						h.db.Model(&user).Update("avatar_url", storedPath)
					}
				}
			}
		} else {
			user.AvatarURL = req.AvatarURL
			h.db.Model(&user).Update("avatar_url", req.AvatarURL)
		}
	}

	empItem := user.ToEmployeeListItem()
	c.JSON(http.StatusCreated, gin.H{
		"message":  "Karyawan berhasil didaftarkan",
		"employee": empItem,
		"data": gin.H{
			"employee": empItem,
		},
	})
}

type UpdateEmployeeRequest struct {
	FullName     *string `json:"fullName"`
	Role         *string `json:"role"`
	Department   *string `json:"department"`
	EmployeeType *string `json:"employeeType"`
	Phone        *string `json:"phone"`
	AvatarURL    *string `json:"avatarUrl"`
	Password     *string `json:"password"`
}

func (h *EmployeeHandler) Update(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "ID karyawan tidak valid."})
		return
	}

	var user domain.User
	if err := h.db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Karyawan tidak ditemukan."})
		return
	}

	var req UpdateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Format data tidak valid."})
		return
	}

	if req.FullName != nil && *req.FullName != "" {
		user.FullName = *req.FullName
	}
	if req.Role != nil && *req.Role != "" {
		user.Role = req.Role
	}
	if req.Department != nil {
		user.Department = req.Department
	}
	if req.EmployeeType != nil && *req.EmployeeType != "" {
		user.EmployeeType = *req.EmployeeType
	}
	if req.Phone != nil {
		user.Phone = req.Phone
	}
	if req.Password != nil && len(*req.Password) >= 6 {
		hashed, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err == nil {
			user.Password = string(hashed)
		}
	}

	// Kompresi Gambar ke WebP (maks 1280x720) & Upload ke RustFS jika ada avatar baru
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
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal memperbarui data karyawan."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Data karyawan berhasil diperbarui",
		"employee": user.ToEmployeeListItem(),
	})
}

func (h *EmployeeHandler) Destroy(c *gin.Context) {
	idParam := strings.TrimSpace(c.Param("id"))
	emailParam := strings.TrimSpace(c.Query("email"))

	var user domain.User
	var found bool

	// 1. Coba cari berdasarkan ID numerik
	if id, err := strconv.ParseUint(idParam, 10, 32); err == nil && id > 0 {
		if err := h.db.First(&user, id).Error; err == nil {
			found = true
		}
	}

	// 2. Jika belum ditemukan, coba cari lewat parameter email atau idParam yang berformat email
	if !found && emailParam != "" {
		if err := h.db.Where("LOWER(email) = ?", strings.ToLower(emailParam)).First(&user).Error; err == nil {
			found = true
		}
	}
	if !found && strings.Contains(idParam, "@") {
		if err := h.db.Where("LOWER(email) = ?", strings.ToLower(idParam)).First(&user).Error; err == nil {
			found = true
		}
	}

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"message": "Karyawan tidak ditemukan di database."})
		return
	}

	// Proteksi: Akun Administrator tidak dapat dihapus
	if strings.HasPrefix(strings.ToLower(user.Email), "admin@") || (user.Role != nil && strings.Contains(strings.ToLower(*user.Role), "admin")) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Akun Administrator tidak dapat dihapus."})
		return
	}

	userEmail := strings.ToLower(strings.TrimSpace(user.Email))

	// Hapus seluruh presensi dan token secara permanen (HARD DELETE)
	h.db.Unscoped().Where("user_id = ?", user.ID).Delete(&domain.Attendance{})
	h.db.Unscoped().Where("tokenable_id = ?", user.ID).Delete(&domain.AccessToken{})

	// Hapus akun karyawan dari tabel users
	if err := h.db.Unscoped().Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal menghapus karyawan dari database."})
		return
	}

	// Jika akun adalah alias (misal mariotelaviv atau telaviv), bersihkan juga aliasnya agar tidak tertinggal
	if userEmail == "mariotelaviv@loginrek.com" || userEmail == "telaviv@loginrek.com" {
		var aliases []domain.User
		h.db.Where("LOWER(email) IN (?, ?)", "mariotelaviv@loginrek.com", "telaviv@loginrek.com").Find(&aliases)
		for _, a := range aliases {
			h.db.Unscoped().Where("user_id = ?", a.ID).Delete(&domain.Attendance{})
			h.db.Unscoped().Where("tokenable_id = ?", a.ID).Delete(&domain.AccessToken{})
			h.db.Unscoped().Delete(&a)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Karyawan berhasil dihapus secara permanen dari database.",
		"deletedId": user.ID,
		"deletedEmail": user.Email,
	})
}

var nonAlphaNum = regexp.MustCompile(`[^a-z0-9]`)

func (h *EmployeeHandler) generateUniqueEmail(fullName string) string {
	parts := strings.Fields(strings.ToLower(fullName))
	first := "karyawan"
	if len(parts) > 0 {
		clean := nonAlphaNum.ReplaceAllString(parts[0], "")
		if clean != "" {
			first = clean
		}
	}
	candidate := fmt.Sprintf("%s@loginrek.com", first)

	var count int64
	h.db.Model(&domain.User{}).Where("LOWER(email) = ?", candidate).Count(&count)
	if count == 0 {
		return candidate
	}

	counter := 2
	for {
		candidate = fmt.Sprintf("%s%d@loginrek.com", first, counter)
		h.db.Model(&domain.User{}).Where("LOWER(email) = ?", candidate).Count(&count)
		if count == 0 {
			return candidate
		}
		counter++
	}
}


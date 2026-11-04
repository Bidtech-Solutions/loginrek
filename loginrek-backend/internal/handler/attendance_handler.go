package handler

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"loginrek-backend/internal/config"
	"loginrek-backend/internal/domain"
	"loginrek-backend/internal/storage"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AttendanceHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	storage storage.StorageService
}

func NewAttendanceHandler(db *gorm.DB, cfg *config.Config, storage storage.StorageService) *AttendanceHandler {
	return &AttendanceHandler{db: db, cfg: cfg, storage: storage}
}

func getJakartaToday() (string, string) {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	now := time.Now().In(loc)
	return now.Format("2006-01-02"), now.Format("15:04:05")
}

func (h *AttendanceHandler) Today(c *gin.Context) {
	val, exists := c.Get("currentUser")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"errors": []gin.H{{"message": "Unauthorized"}}})
		return
	}
	user := val.(domain.User)

	todayDate, serverTime := getJakartaToday()

	var att domain.Attendance
	err := h.db.
		Where("user_id = ? AND date = ?", user.ID, todayDate).
		Preload("User").
		First(&att).Error

	hasAttended := (err == nil)
	var attResponse *domain.AttendanceItemResponse
	if hasAttended {
		resp := att.ToResponse()
		attResponse = &resp
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"hasAttended": hasAttended,
			"attendance":  attResponse,
			"serverTime":  serverTime,
			"today":       todayDate,
		},
	})
}

type CheckInRequest struct {
	ClockInTime    string   `json:"clockInTime" binding:"required"`
	IsLate         bool     `json:"isLate"`
	Status         string   `json:"status"`
	Photo          string   `json:"photo"`
	Latitude       *float64 `json:"latitude"`
	Longitude      *float64 `json:"longitude"`
	DistanceMeters int      `json:"distanceMeters"`
	OfficeName     string   `json:"officeName"`
	IsOfflineSync  bool     `json:"isOfflineSync"`
	Date           string   `json:"date"`
}

func (h *AttendanceHandler) CheckIn(c *gin.Context) {
	val, exists := c.Get("currentUser")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"errors": []gin.H{{"message": "Unauthorized"}}})
		return
	}
	user := val.(domain.User)

	var req CheckInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"errors": []gin.H{{"message": "Data presensi tidak lengkap."}}})
		return
	}

	todayDate, _ := getJakartaToday()
	dateToUse := todayDate
	if req.Date != "" {
		dateToUse = req.Date
	}

	// Pencegahan Absensi Berulang: Cek apakah user sudah absen hari ini
	var existing domain.Attendance
	if err := h.db.Where("user_id = ? AND date = ?", user.ID, dateToUse).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"errors": []gin.H{
				{
					"message": fmt.Sprintf("User sudah melakukan presensi hari ini pada %s", existing.ClockInTime),
				},
			},
		})
		return
	}

	status := req.Status
	if status == "" {
		if req.IsLate {
			status = "Terlambat"
		} else {
			status = "Tepat Waktu"
		}
	}
	office := req.OfficeName
	if office == "" {
		office = "Kantor Piposmart"
	}

	var photoPathPtr *string

	// Otomatis Kompresi Gambar ke WebP (Maks 1280x720) & Simpan ke RustFS / S3
	if req.Photo != "" {
		if strings.HasPrefix(req.Photo, "data:image/") || strings.Contains(req.Photo, ";base64,") {
			rawBytes, errDecode := storage.DecodeBase64OrBytes(req.Photo)
			if errDecode == nil {
				processed, errProc := storage.ProcessAndConvertToWebP(
					rawBytes,
					h.cfg.ImageMaxWidth,
					h.cfg.ImageMaxHeight,
					h.cfg.ImageQuality,
				)
				if errProc == nil {
					filename := fmt.Sprintf("selfie_%d_%d.webp", user.ID, time.Now().UnixMilli())
					storedPath, errUpload := h.storage.UploadImage(
						c.Request.Context(),
						"attendances",
						filename,
						processed.Data,
						processed.ContentType,
					)
					if errUpload == nil {
						photoPathPtr = &storedPath
					}
				}
			}
		} else {
			photoPathPtr = &req.Photo
		}
	}

	att := domain.Attendance{
		UserID:         user.ID,
		Date:           dateToUse,
		ClockInTime:    strings.TrimSpace(req.ClockInTime),
		Status:         status,
		IsLate:         req.IsLate,
		PhotoPath:      photoPathPtr,
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		DistanceMeters: req.DistanceMeters,
		OfficeName:     office,
		IsOfflineSync:  req.IsOfflineSync,
	}

	if err := h.db.Create(&att).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"errors": []gin.H{{"message": "Gagal mencatat presensi ke database."}}})
		return
	}

	// Preload user for response
	h.db.Preload("User").First(&att, att.ID)

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"message":    "Presensi berhasil dicatat",
			"attendance": att.ToResponse(),
		},
	})
}

func (h *AttendanceHandler) Index(c *gin.Context) {
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "20")
	all := c.Query("all") == "true"
	dateFilter := c.Query("date")

	page, _ := strconv.Atoi(pageStr)
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(limitStr)
	if limit < 1 {
		limit = 20
	}
	if all {
		limit = 500
	}

	query := h.db.Model(&domain.Attendance{}).Preload("User").Order("id desc")
	if dateFilter != "" {
		query = query.Where("date = ?", dateFilter)
	}

	var total int64
	query.Count(&total)

	offset := (page - 1) * limit
	var records []domain.Attendance
	if err := query.Offset(offset).Limit(limit).Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal mengambil data presensi."})
		return
	}

	dataList := make([]domain.AttendanceItemResponse, 0, len(records))
	for _, r := range records {
		dataList = append(dataList, r.ToResponse())
	}

	lastPage := int(math.Ceil(float64(total) / float64(limit)))
	if lastPage < 1 {
		lastPage = 1
	}

	c.JSON(http.StatusOK, gin.H{
		"meta": gin.H{
			"total":       total,
			"perPage":     limit,
			"currentPage": page,
			"lastPage":    lastPage,
		},
		"data": dataList,
	})
}


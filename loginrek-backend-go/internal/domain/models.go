package domain

import (
	"fmt"
	"strings"
	"time"
)

type User struct {
	ID           uint         `gorm:"primaryKey" json:"id"`
	FullName     string       `gorm:"type:varchar(255);not null" json:"fullName"`
	Email        string       `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	Password     string       `gorm:"type:varchar(255);not null" json:"-"`
	Role         *string      `gorm:"type:varchar(100)" json:"role"`
	Department   *string      `gorm:"type:varchar(100)" json:"department"`
	EmployeeType string       `gorm:"type:varchar(50);default:'Karyawan'" json:"employeeType"`
	Phone        *string      `gorm:"type:varchar(50)" json:"phone"`
	AvatarURL    *string      `gorm:"type:text" json:"avatarUrl"`
	CreatedAt    time.Time    `json:"createdAt"`
	UpdatedAt    time.Time    `json:"updatedAt"`
	Attendances  []Attendance `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"attendances,omitempty"`
}

func (u *User) GetInitials() string {
	parts := strings.Fields(strings.TrimSpace(u.FullName))
	if len(parts) == 0 {
		return "KR"
	}
	if len(parts) == 1 {
		runes := []rune(parts[0])
		if len(runes) >= 2 {
			return strings.ToUpper(string(runes[:2]))
		}
		return strings.ToUpper(string(runes[:1]))
	}
	r1 := []rune(parts[0])
	r2 := []rune(parts[len(parts)-1])
	return strings.ToUpper(string(r1[:1]) + string(r2[:1]))
}

func (u *User) GetNIK() string {
	return fmt.Sprintf("LR-%05d", u.ID)
}

type Attendance struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	UserID         uint      `gorm:"not null;index" json:"userId"`
	User           *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Date           string    `gorm:"type:varchar(10);not null;index" json:"date"` // YYYY-MM-DD
	ClockInTime    string    `gorm:"type:varchar(20);not null" json:"clockInTime"` // e.g. "08.00 WIB"
	Status         string    `gorm:"type:varchar(30);not null" json:"status"`      // "Tepat Waktu" | "Terlambat"
	IsLate         bool      `gorm:"default:false" json:"isLate"`
	PhotoPath      *string   `gorm:"type:text" json:"photoPath"`
	Latitude       *float64  `json:"latitude"`
	Longitude      *float64  `json:"longitude"`
	DistanceMeters int       `gorm:"default:0" json:"distanceMeters"`
	OfficeName     string    `gorm:"type:varchar(100);default:'Kantor Piposmart'" json:"officeName"`
	IsOfflineSync  bool      `gorm:"default:false" json:"isOfflineSync"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type AccessToken struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	TokenableID  uint       `gorm:"not null;index" json:"tokenableId"`
	Type         string     `gorm:"type:varchar(50);default:'auth_token'" json:"type"`
	Name         string     `gorm:"type:varchar(100);default:'mobile'" json:"name"`
	TokenHash    string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"-"`
	CreatedAt    time.Time  `json:"createdAt"`
	ExpiresAt    *time.Time `json:"expiresAt"`
}

// UserResponse represents user data returned in auth endpoints
type UserResponse struct {
	ID           uint    `json:"id"`
	FullName     string  `json:"fullName"`
	Name         string  `json:"name"`
	Email        string  `json:"email"`
	Initials     string  `json:"initials"`
	Role         *string `json:"role"`
	Department   *string `json:"department"`
	EmployeeType string  `json:"employeeType"`
	Type         string  `json:"type"`
	AvatarURL    *string `json:"avatarUrl"`
	Avatar       *string `json:"avatar,omitempty"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:           u.ID,
		FullName:     u.FullName,
		Name:         u.FullName,
		Email:        u.Email,
		Initials:     u.GetInitials(),
		Role:         u.Role,
		Department:   u.Department,
		EmployeeType: u.EmployeeType,
		Type:         u.EmployeeType,
		AvatarURL:    u.AvatarURL,
		Avatar:       u.AvatarURL,
	}
}

// EmployeeListItem represents an employee in the web dashboard list
type EmployeeListItem struct {
	ID                uint    `json:"id"`
	Name              string  `json:"name"`
	FullName          string  `json:"fullName"`
	Email             string  `json:"email"`
	NIK               string  `json:"nik"`
	Role              string  `json:"role"`
	Department        string  `json:"department"`
	Type              string  `json:"type"`
	EmployeeType      string  `json:"employeeType"`
	Phone             string  `json:"phone"`
	Avatar            string  `json:"avatar"`
	Initials          string  `json:"initials"`
	JoinDate          string  `json:"joinDate"`
	AttendanceSummary string  `json:"attendanceSummary"`
	AttendanceCount   int     `json:"attendanceCount"`
	OnTimeCount       string  `json:"onTimeCount"`
	LateCount         string  `json:"lateCount"`
	Status            string  `json:"status"`
}

func (u *User) ToEmployeeListItem() EmployeeListItem {
	roleStr := "Karyawan"
	if u.Role != nil && *u.Role != "" {
		roleStr = *u.Role
	}
	deptStr := "Engineering"
	if u.Department != nil && *u.Department != "" {
		deptStr = *u.Department
	}
	phoneStr := ""
	if u.Phone != nil {
		phoneStr = *u.Phone
	}
	avatarStr := ""
	if u.AvatarURL != nil {
		avatarStr = *u.AvatarURL
	}

	onTime := 0
	late := 0
	for _, a := range u.Attendances {
		if a.IsLate {
			late++
		} else {
			onTime++
		}
	}

	joinDateStr := u.CreatedAt.Format("02 Jan 2006")
	if u.CreatedAt.IsZero() {
		joinDateStr = "Hari ini"
	}

	return EmployeeListItem{
		ID:                u.ID,
		Name:              u.FullName,
		FullName:          u.FullName,
		Email:             u.Email,
		NIK:               u.GetNIK(),
		Role:              roleStr,
		Department:        deptStr,
		Type:              u.EmployeeType,
		EmployeeType:      u.EmployeeType,
		Phone:             phoneStr,
		Avatar:            avatarStr,
		Initials:          u.GetInitials(),
		JoinDate:          joinDateStr,
		AttendanceSummary: fmt.Sprintf("%d Hari", len(u.Attendances)),
		AttendanceCount:   len(u.Attendances),
		OnTimeCount:       fmt.Sprintf("%dx", onTime),
		LateCount:         fmt.Sprintf("%dx", late),
		Status:            "Aktif",
	}
}

// AttendanceItemResponse represents attendance returned in lists
type AttendanceItemResponse struct {
	ID             uint          `json:"id"`
	UserID         uint          `json:"userId"`
	Date           string        `json:"date"`
	ClockInTime    string        `json:"clockInTime"`
	Status         string        `json:"status"`
	IsLate         bool          `json:"isLate"`
	PhotoPath      *string       `json:"photoPath"`
	Latitude       *float64      `json:"latitude"`
	Longitude      *float64      `json:"longitude"`
	DistanceMeters int           `json:"distanceMeters"`
	OfficeName     string        `json:"officeName"`
	IsOfflineSync  bool          `json:"isOfflineSync"`
	CreatedAt      string        `json:"createdAt"`
	Name           string        `json:"name"`
	FullName       string        `json:"fullName"`
	Type           string        `json:"type"`
	EmployeeType   string        `json:"employeeType"`
	Role           string        `json:"role"`
	Department     string        `json:"department"`
	Avatar         *string       `json:"avatar,omitempty"`
	User           *UserResponse `json:"user,omitempty"`
}

func (a *Attendance) ToResponse() AttendanceItemResponse {
	var userResp *UserResponse
	empName := "Karyawan"
	empType := "Karyawan"
	empRole := "Karyawan"
	empDept := "Engineering"
	var avatarPtr *string

	if a.User != nil {
		resp := a.User.ToResponse()
		userResp = &resp
		if a.User.FullName != "" {
			empName = a.User.FullName
		}
		if a.User.EmployeeType != "" {
			empType = a.User.EmployeeType
		}
		if a.User.Role != nil && *a.User.Role != "" {
			empRole = *a.User.Role
		}
		if a.User.Department != nil && *a.User.Department != "" {
			empDept = *a.User.Department
		}
		avatarPtr = a.User.AvatarURL
	}

	return AttendanceItemResponse{
		ID:             a.ID,
		UserID:         a.UserID,
		Date:           a.Date,
		ClockInTime:    a.ClockInTime,
		Status:         a.Status,
		IsLate:         a.IsLate,
		PhotoPath:      a.PhotoPath,
		Latitude:       a.Latitude,
		Longitude:      a.Longitude,
		DistanceMeters: a.DistanceMeters,
		OfficeName:     a.OfficeName,
		IsOfflineSync:  a.IsOfflineSync,
		CreatedAt:      a.CreatedAt.Format(time.RFC3339),
		Name:           empName,
		FullName:       empName,
		Type:           empType,
		EmployeeType:   empType,
		Role:           empRole,
		Department:     empDept,
		Avatar:         avatarPtr,
		User:           userResp,
	}
}


package middleware

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"loginrek-backend/internal/domain"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

type JWTClaims struct {
	UserID uint   `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func GenerateToken(userID uint, email string, secret string) (string, error) {
	claims := JWTClaims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)), // 30 hari
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func RequireAuth(secret string, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"errors": []gin.H{
					{"message": "Unauthorized access: Bearer token is missing"},
				},
			})
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		tokenStr = strings.TrimSpace(tokenStr)

		token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("metode signing token tidak valid")
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{
				"errors": []gin.H{
					{"message": "Unauthorized access: Invalid or expired token"},
				},
			})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{
				"errors": []gin.H{
					{"message": "Unauthorized access: Invalid token claims"},
				},
			})
			c.Abort()
			return
		}

		var user domain.User
		if err := db.First(&user, claims.UserID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"errors": []gin.H{
					{"message": "Unauthorized access: User not found"},
				},
			})
			c.Abort()
			return
		}

		c.Set("currentUser", user)
		c.Set("userId", user.ID)
		c.Next()
	}
}

// RequireAdmin hanya meloloskan akun HR/admin (users.is_admin = true). Pasang SETELAH RequireAuth.
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		val, exists := c.Get("currentUser")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"errors": []gin.H{{"message": "Unauthorized"}}})
			c.Abort()
			return
		}
		if user, ok := val.(domain.User); !ok || !user.IsAdmin {
			c.JSON(http.StatusForbidden, gin.H{"errors": []gin.H{{"message": "Akses dashboard ditolak"}}})
			c.Abort()
			return
		}
		c.Next()
	}
}

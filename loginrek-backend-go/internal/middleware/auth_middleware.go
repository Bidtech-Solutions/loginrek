package middleware

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"loginrek-backend-go/internal/domain"

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
			// Dukung token offline fallback dari mobile (misal: token-usr-11, token-usr-achul-11)
			if strings.HasPrefix(tokenStr, "token-") {
				raw := strings.TrimPrefix(tokenStr, "token-")
				var fallbackUser domain.User
				var found bool

				if strings.HasPrefix(raw, "usr-") {
					parts := strings.Split(raw, "-")
					lastPart := parts[len(parts)-1]
					if idNum, parseErr := strconv.Atoi(lastPart); parseErr == nil && idNum > 0 {
						if dbErr := db.First(&fallbackUser, idNum).Error; dbErr == nil {
							found = true
						}
					}
					if !found && len(parts) >= 2 {
						username := parts[1]
						if dbErr := db.Where("email LIKE ?", username+"@%").First(&fallbackUser).Error; dbErr == nil {
							found = true
						}
					}
				}

				if found {
					c.Set("currentUser", fallbackUser)
					c.Set("userId", fallbackUser.ID)
					c.Next()
					return
				}
			}

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


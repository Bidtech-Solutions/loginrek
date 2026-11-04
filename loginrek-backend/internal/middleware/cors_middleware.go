package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CORSMiddleware hanya mengizinkan origin browser yang terdaftar (CORS_ORIGINS), mis. dashboard.
// Aplikasi mobile bukan browser sehingga tidak butuh CORS.
func CORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = struct{}{}
	}

	return func(c *gin.Context) {
		c.Writer.Header().Add("Vary", "Origin")

		origin := c.GetHeader("Origin")
		if _, ok := allowed[origin]; ok && origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Cache-Control")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")
			c.Writer.Header().Set("Access-Control-Max-Age", "600")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

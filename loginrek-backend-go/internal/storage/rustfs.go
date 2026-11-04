package storage

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"loginrek-backend-go/internal/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type StorageService interface {
	UploadImage(ctx context.Context, subfolder, filename string, data []byte, contentType string) (string, error)
}

type RustFSStorage struct {
	client    *minio.Client
	bucket    string
	publicURL string
	cfg       *config.Config
}

func NewStorageService(cfg *config.Config) StorageService {
	// If RustFS S3 endpoint is configured, initialize MinIO S3 client
	if cfg.RustFSEndpoint != "" && cfg.RustFSAccessKey != "" {
		minioClient, err := minio.New(cfg.RustFSEndpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(cfg.RustFSAccessKey, cfg.RustFSSecretKey, ""),
			Secure: cfg.RustFSUseSSL,
		})
		if err == nil {
			// Auto create bucket if not existing
			ctx := context.Background()
			exists, errBucket := minioClient.BucketExists(ctx, cfg.RustFSBucket)
			if errBucket == nil && !exists {
				_ = minioClient.MakeBucket(ctx, cfg.RustFSBucket, minio.MakeBucketOptions{})
			}
			log.Printf("[Storage] Terhubung ke RustFS S3 Bucket: %s di %s", cfg.RustFSBucket, cfg.RustFSEndpoint)
			return &RustFSStorage{
				client:    minioClient,
				bucket:    cfg.RustFSBucket,
				publicURL: cfg.RustFSPublicURL,
				cfg:       cfg,
			}
		}
		log.Printf("[Storage] Peringatan: Gagal terhubung ke RustFS (%v), menggunakan penyimpanan lokal disk sebagai fallback.", err)
	}

	log.Println("[Storage] Menggunakan penyimpanan lokal disk (public/uploads/) sebagai storage aktif.")
	return &LocalStorage{baseDir: "public/uploads"}
}

func (s *RustFSStorage) UploadImage(ctx context.Context, subfolder, filename string, data []byte, contentType string) (string, error) {
	objectKey := fmt.Sprintf("%s/%s", strings.Trim(subfolder, "/"), filename)

	reader := bytes.NewReader(data)
	_, err := s.client.PutObject(ctx, s.bucket, objectKey, reader, int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		// Fallback to local disk if RustFS upload fails
		log.Printf("[Storage] Gagal upload ke RustFS: %v. Menyimpan ke disk lokal.", err)
		local := &LocalStorage{baseDir: "public/uploads"}
		return local.UploadImage(ctx, subfolder, filename, data, contentType)
	}

	// Return public URL if configured, otherwise S3 object path
	if s.publicURL != "" {
		return fmt.Sprintf("%s/%s", strings.TrimRight(s.publicURL, "/"), objectKey), nil
	}
	return fmt.Sprintf("/uploads/%s", objectKey), nil
}

type LocalStorage struct {
	baseDir string
}

func (l *LocalStorage) UploadImage(ctx context.Context, subfolder, filename string, data []byte, contentType string) (string, error) {
	targetDir := filepath.Join(l.baseDir, subfolder)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return "", fmt.Errorf("gagal membuat direktori lokal: %w", err)
	}

	targetPath := filepath.Join(targetDir, filename)
	if err := os.WriteFile(targetPath, data, 0644); err != nil {
		return "", fmt.Errorf("gagal menulis file gambar lokal: %w", err)
	}

	// Return clean relative path matching current frontend routing
	return fmt.Sprintf("/uploads/%s/%s", strings.Trim(subfolder, "/"), filename), nil
}


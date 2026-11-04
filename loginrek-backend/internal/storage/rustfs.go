package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"time"

	"loginrek-backend/internal/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type StorageService interface {
	UploadImage(ctx context.Context, subfolder, filename string, data []byte, contentType string) (string, error)
	// OpenImage membuka objek berdasarkan key ("attendances/selfie_1_x.webp") untuk disajikan
	// lewat GET /uploads/*key, sehingga RustFS cukup berada di jaringan internal.
	OpenImage(ctx context.Context, key string) (io.ReadCloser, string, error)
}

// ErrImageNotFound dikembalikan OpenImage bila key tidak ada / tidak valid.
var ErrImageNotFound = errors.New("gambar tidak ditemukan")

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
			// Pastikan bucket ada. RustFS di docker compose bisa lebih lambat siap daripada backend,
			// jadi dicoba ulang beberapa kali sebelum menyerah ke penyimpanan lokal.
			if errBucket := ensureBucket(minioClient, cfg.RustFSBucket); errBucket != nil {
				log.Printf("[Storage] Peringatan: RustFS belum dapat dihubungi (%v), menggunakan penyimpanan lokal disk sebagai fallback.", errBucket)
				return &LocalStorage{baseDir: "public/uploads"}
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

const (
	bucketCheckAttempts = 15
	bucketCheckInterval = 2 * time.Second
)

func ensureBucket(client *minio.Client, bucket string) error {
	var lastErr error
	for attempt := 1; attempt <= bucketCheckAttempts; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		exists, err := client.BucketExists(ctx, bucket)
		if err == nil && !exists {
			err = client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{})
		}
		cancel()
		if err == nil {
			return nil
		}
		lastErr = err
		if attempt < bucketCheckAttempts {
			time.Sleep(bucketCheckInterval)
		}
	}
	return lastErr
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

func (s *RustFSStorage) OpenImage(ctx context.Context, key string) (io.ReadCloser, string, error) {
	obj, err := s.client.GetObject(ctx, s.bucket, strings.TrimPrefix(key, "/"), minio.GetObjectOptions{})
	if err == nil {
		if st, errStat := obj.Stat(); errStat == nil {
			return obj, st.ContentType, nil
		}
		_ = obj.Close()
	}
	// File yang disimpan ke disk lokal saat RustFS gagal / aset bawaan (mis. default_avatar.png)
	return (&LocalStorage{baseDir: "public/uploads"}).OpenImage(ctx, key)
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

func (l *LocalStorage) OpenImage(ctx context.Context, key string) (io.ReadCloser, string, error) {
	clean := filepath.Clean(filepath.FromSlash(strings.TrimPrefix(key, "/")))
	if clean == "." || filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return nil, "", ErrImageNotFound
	}
	f, err := os.Open(filepath.Join(l.baseDir, clean))
	if err != nil {
		return nil, "", ErrImageNotFound
	}
	ct := mime.TypeByExtension(strings.ToLower(filepath.Ext(clean)))
	if ct == "" && strings.EqualFold(filepath.Ext(clean), ".webp") {
		ct = "image/webp"
	}
	if ct == "" {
		ct = "application/octet-stream"
	}
	return f, ct, nil
}

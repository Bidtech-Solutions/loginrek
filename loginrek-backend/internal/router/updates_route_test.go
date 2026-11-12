package router_test

import (
	"mime"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"loginrek-backend/internal/router"
	"loginrek-backend/internal/storage"

	"github.com/gin-gonic/gin"
)

// updatesEngine merakit router dengan UpdatesDir sementara. Isi folder diatur tes masing-masing.
func updatesEngine(t *testing.T) (*gin.Engine, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := testConfig(t)
	cfg.UpdatesDir = t.TempDir()
	db := openDB(t, cfg)
	return router.New(cfg, db, storage.NewStorageService(cfg)), cfg.UpdatesDir
}

func updatesRequest(e *gin.Engine, method, path string, hdr map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil) // sengaja TANPA Authorization
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

var iosHeaders = map[string]string{
	"expo-protocol-version": "1",
	"expo-platform":         "ios",
	"expo-runtime-version":  "1.0.2",
	"expo-channel-name":     "production",
}

// Belum ada update: 204, dan rute ini publik (bukan 401).
func TestUpdatesManifestNoUpdateIsPublic204(t *testing.T) {
	e, _ := updatesEngine(t)
	rec := updatesRequest(e, http.MethodGet, "/updates/manifest", iosHeaders)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("want 204 tanpa auth, got %d: %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("expo-protocol-version") != "1" {
		t.Fatal("header expo-protocol-version hilang")
	}
}

// Input tidak valid: 400 (bukan 401/404), tetap tanpa auth.
func TestUpdatesManifestBadRequest(t *testing.T) {
	e, _ := updatesEngine(t)
	rec := updatesRequest(e, http.MethodGet, "/updates/manifest", map[string]string{"expo-platform": "windows"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rec.Code)
	}
}

// Ada update: manifest multipart + tanda tangan dikirim, berkas disajikan immutable (GET dan HEAD), semua tanpa auth.
func TestUpdatesServedWithoutAuth(t *testing.T) {
	e, root := updatesEngine(t)

	const pubID = "20261112T100000Z-abc1234"
	dir := filepath.Join(root, "production", "1.0.2")
	pub := filepath.Join(dir, pubID)
	if err := os.MkdirAll(filepath.Join(pub, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	write := func(p, s string) {
		t.Helper()
		if err := os.WriteFile(p, []byte(s), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write(filepath.Join(dir, "latest.json"), `{"publishId":"`+pubID+`"}`)
	write(filepath.Join(pub, "manifest.ios.json"), `{"id":"ios-manifest"}`)
	write(filepath.Join(pub, "manifest.ios.sig"), "sig=\"QUJD\", keyid=\"main\"\n")
	write(filepath.Join(pub, "assets", "abc"), "asset-bytes")

	hdr := map[string]string{"expo-expect-signature": `sig, keyid="main"`}
	for k, v := range iosHeaders {
		hdr[k] = v
	}
	rec := updatesRequest(e, http.MethodGet, "/updates/manifest", hdr)
	if rec.Code != http.StatusOK {
		t.Fatalf("manifest: want 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if mt, _, err := mime.ParseMediaType(rec.Header().Get("content-type")); err != nil || mt != "multipart/mixed" {
		t.Fatalf("content-type: %q %v", rec.Header().Get("content-type"), err)
	}
	if !strings.Contains(rec.Body.String(), `expo-signature: sig="QUJD", keyid="main"`) {
		t.Fatalf("expo-signature tidak ada di body: %q", rec.Body.String())
	}

	filePath := "/updates/files/production/1.0.2/" + pubID + "/assets/abc"
	for _, m := range []string{http.MethodGet, http.MethodHead} {
		rec := updatesRequest(e, m, filePath, nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s berkas: want 200, got %d", m, rec.Code)
		}
		if !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
			t.Fatalf("%s berkas: Cache-Control %q", m, rec.Header().Get("Cache-Control"))
		}
	}
	if rec := updatesRequest(e, http.MethodGet, filePath, nil); rec.Body.String() != "asset-bytes" {
		t.Fatalf("isi berkas: %q", rec.Body.String())
	}
}

// Rute lain tetap terlindungi: menambah /updates tidak boleh membuka endpoint ber-auth.
func TestUpdatesDoesNotOpenOtherRoutes(t *testing.T) {
	e, _ := updatesEngine(t)
	if rec := updatesRequest(e, http.MethodGet, "/api/v1/employees", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("want 401 untuk /api/v1/employees tanpa token, got %d", rec.Code)
	}
}

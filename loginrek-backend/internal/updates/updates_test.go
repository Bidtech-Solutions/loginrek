package updates

import (
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func fixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	dir := filepath.Join(root, "production", "1.0.2")
	pub := filepath.Join(dir, "20261112T100000Z-abc1234")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.MkdirAll(filepath.Join(pub, "assets"), 0o755))
	must(os.WriteFile(filepath.Join(dir, "latest.json"), []byte(`{"publishId":"20261112T100000Z-abc1234"}`), 0o644))
	must(os.WriteFile(filepath.Join(pub, "manifest.ios.json"), []byte(`{"id":"ios-manifest"}`), 0o644))
	must(os.WriteFile(filepath.Join(pub, "manifest.ios.sig"), []byte("sig=\"QUJD\", keyid=\"main\"\n"), 0o644))
	must(os.WriteFile(filepath.Join(pub, "assets", "abc"), []byte("asset-bytes"), 0o644))
	return root
}

func get(h http.Handler, path string, hdr map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestManifestSigned(t *testing.T) {
	h := NewHandler(fixture(t))
	rec := get(h, "/manifest", map[string]string{
		"expo-protocol-version": "1",
		"expo-platform":         "ios",
		"expo-runtime-version":  "1.0.2",
		"expo-channel-name":     "production",
		"expo-expect-signature": `sig, keyid="main"`,
	})
	if rec.Code != 200 {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("expo-protocol-version") != "1" || rec.Header().Get("expo-sfv-version") != "0" {
		t.Fatal("protocol headers missing")
	}
	if !strings.Contains(rec.Header().Get("cache-control"), "max-age=0") {
		t.Fatal("manifest must not be cacheable")
	}
	mt, params, err := mime.ParseMediaType(rec.Header().Get("content-type"))
	if err != nil || mt != "multipart/mixed" {
		t.Fatalf("content-type: %v %v", mt, err)
	}
	mr := multipart.NewReader(rec.Body, params["boundary"])
	part, err := mr.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	if part.FormName() != "manifest" {
		t.Fatalf("form name %q", part.FormName())
	}
	if got := part.Header.Get("expo-signature"); got != `sig="QUJD", keyid="main"` {
		t.Fatalf("signature header %q", got)
	}
	b, _ := io.ReadAll(part)
	if string(b) != `{"id":"ios-manifest"}` {
		t.Fatalf("manifest body %q", b)
	}
	if _, err := mr.NextPart(); err != io.EOF {
		t.Fatalf("expected a single part, got %v", err)
	}
}

func TestManifestUnsignedWhenNotRequested(t *testing.T) {
	h := NewHandler(fixture(t))
	rec := get(h, "/manifest", map[string]string{"expo-platform": "ios", "expo-runtime-version": "1.0.2"})
	if rec.Code != 200 {
		t.Fatalf("status %d", rec.Code)
	}
	if strings.Contains(strings.ToLower(rec.Body.String()), "expo-signature") {
		t.Fatal("signature must be omitted when not requested")
	}
}

func TestNoUpdateForUnknownRuntime(t *testing.T) {
	h := NewHandler(fixture(t))
	rec := get(h, "/manifest", map[string]string{"expo-platform": "ios", "expo-runtime-version": "9.9.9"})
	if rec.Code != http.StatusNoContent {
		t.Fatalf("want 204, got %d", rec.Code)
	}
}

func TestBadRequests(t *testing.T) {
	h := NewHandler(fixture(t))
	cases := []map[string]string{
		{"expo-platform": "windows", "expo-runtime-version": "1.0.2"},
		{"expo-platform": "ios"},
		{"expo-platform": "ios", "expo-runtime-version": "../etc"},
		{"expo-platform": "ios", "expo-runtime-version": "1.0.2", "expo-channel-name": "../../x"},
		{"expo-platform": "ios", "expo-runtime-version": "1.0.2", "expo-protocol-version": "0"},
	}
	for i, hdr := range cases {
		if rec := get(h, "/manifest", hdr); rec.Code != http.StatusBadRequest {
			t.Errorf("case %d: want 400, got %d", i, rec.Code)
		}
	}
}

func TestFiles(t *testing.T) {
	h := NewHandler(fixture(t))
	rec := get(h, "/files/production/1.0.2/20261112T100000Z-abc1234/assets/abc", nil)
	if rec.Code != 200 || rec.Body.String() != "asset-bytes" {
		t.Fatalf("asset: %d %q", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
		t.Fatal("assets should be immutable")
	}
	if rec := get(h, "/files/production/1.0.2/", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("directory listing must be refused, got %d", rec.Code)
	}
	if rec := get(h, "/files/production/1.0.2/latest.json", nil); rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("latest.json must not be cached")
	}
	if rec := get(h, "/files/../../etc/passwd", nil); rec.Code == 200 {
		t.Fatal("path traversal must not succeed")
	}
}

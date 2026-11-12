// Package updates adalah server Expo Updates (protocol v1) yang minimal.
//
// Server ini sengaja "bodoh": manifest dan tanda tangannya sudah dibuat oleh CI
// (langkah "Buat manifest dan tanda tangan" di .github/workflows/loginrek.yml), jadi di sini hanya memilih update terbaru
// untuk (channel, runtimeVersion, platform) lalu menyajikannya.
//
// Tata letak di disk (UPDATES_DIR):
//
//	<root>/<channel>/<runtime>/latest.json                  {"publishId":"..."}
//	<root>/<channel>/<runtime>/<publishId>/manifest.<platform>.json
//	<root>/<channel>/<runtime>/<publishId>/manifest.<platform>.sig
//	<root>/<channel>/<runtime>/<publishId>/_expo/... , assets/...   (bundle & aset)
//
// Pasang dengan prefix, misalnya:
//
//	mux.Handle("/updates/", http.StripPrefix("/updates", updates.NewHandler(dir)))
//
// Rute yang tersedia setelah prefix dilepas:
//
//	GET /manifest   -> endpoint manifest (URL di app.json: https://host/updates/manifest)
//	GET /files/...  -> bundle dan aset (immutable, aman di-cache Cloudflare)
package updates

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Hanya karakter aman untuk nama folder, mencegah path traversal.
var safeSegment = regexp.MustCompile(`^[A-Za-z0-9._-]{1,64}$`)

func isSafe(s string) bool { return safeSegment.MatchString(s) && s != "." && s != ".." }

// Handler menyajikan manifest dan berkas update.
type Handler struct {
	root           string
	defaultChannel string
	files          http.Handler
}

// NewHandler membuat handler. root adalah folder update (mis. /data/updates).
func NewHandler(root string) *Handler {
	return &Handler{
		root:           root,
		defaultChannel: "production",
		files:          http.StripPrefix("/files/", http.FileServer(noDirFS{http.Dir(root)})),
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.URL.Path == "/manifest":
		h.manifest(w, r)
	case strings.HasPrefix(r.URL.Path, "/files/"):
		h.serveFile(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) manifest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if pv := r.Header.Get("expo-protocol-version"); pv != "" && pv != "1" {
		http.Error(w, "unsupported expo-protocol-version", http.StatusBadRequest)
		return
	}
	platform := r.Header.Get("expo-platform")
	if platform != "ios" && platform != "android" {
		http.Error(w, "expo-platform must be ios or android", http.StatusBadRequest)
		return
	}
	runtime := r.Header.Get("expo-runtime-version")
	channel := r.Header.Get("expo-channel-name")
	if channel == "" {
		channel = h.defaultChannel
	}
	if !isSafe(runtime) || !isSafe(channel) {
		http.Error(w, "invalid runtime version or channel", http.StatusBadRequest)
		return
	}

	dir := filepath.Join(h.root, channel, runtime)
	var latest struct {
		PublishID string `json:"publishId"`
	}
	if err := readJSON(filepath.Join(dir, "latest.json"), &latest); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			noUpdate(w) // belum ada update untuk runtime ini: klien tetap memakai bundle bawaan
			return
		}
		log.Printf("updates: read latest.json (%s/%s): %v", channel, runtime, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if !isSafe(latest.PublishID) {
		log.Printf("updates: invalid publishId in latest.json (%s/%s)", channel, runtime)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	pub := filepath.Join(dir, latest.PublishID)
	manifest, err := os.ReadFile(filepath.Join(pub, "manifest."+platform+".json"))
	if err != nil {
		log.Printf("updates: read manifest (%s/%s/%s/%s): %v", channel, runtime, latest.PublishID, platform, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Klien yang memakai code signing mengirim expo-expect-signature.
	signature := ""
	if r.Header.Get("expo-expect-signature") != "" {
		b, err := os.ReadFile(filepath.Join(pub, "manifest."+platform+".sig"))
		if err != nil {
			log.Printf("updates: signature missing (%s/%s/%s/%s): %v", channel, runtime, latest.PublishID, platform, err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		signature = strings.TrimSpace(string(b))
	}

	// multipart/mixed ditulis manual agar nama header tetap huruf kecil persis seperti spesifikasi.
	boundary := newBoundary()
	var body strings.Builder
	body.WriteString("--" + boundary + "\r\n")
	body.WriteString("content-disposition: form-data; name=\"manifest\"\r\n")
	body.WriteString("content-type: application/json; charset=utf-8\r\n")
	if signature != "" {
		body.WriteString("expo-signature: " + signature + "\r\n")
	}
	body.WriteString("\r\n")
	body.Write(manifest)
	body.WriteString("\r\n--" + boundary + "--\r\n")

	setProtocolHeaders(w)
	w.Header().Set("content-type", "multipart/mixed; boundary="+boundary)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(body.String()))
}

func (h *Handler) serveFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if filepath.Base(r.URL.Path) == "latest.json" {
		w.Header().Set("Cache-Control", "no-store")
	} else {
		// Path berisi publishId, jadi isinya tidak pernah berubah.
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	h.files.ServeHTTP(w, r)
}

func noUpdate(w http.ResponseWriter) {
	setProtocolHeaders(w)
	w.WriteHeader(http.StatusNoContent)
}

func setProtocolHeaders(w http.ResponseWriter) {
	w.Header().Set("expo-protocol-version", "1")
	w.Header().Set("expo-sfv-version", "0")
	w.Header().Set("cache-control", "private, max-age=0") // manifest tidak boleh di-cache
}

func readJSON(path string, v any) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func newBoundary() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("updates: crypto/rand: %v", err))
	}
	return "expo-" + hex.EncodeToString(b)
}

// noDirFS menolak daftar isi folder agar struktur update tidak terbuka.
type noDirFS struct{ fs http.FileSystem }

func (n noDirFS) Open(name string) (http.File, error) {
	f, err := n.fs.Open(name)
	if err != nil {
		return nil, err
	}
	st, err := f.Stat()
	if err != nil {
		_ = f.Close()
		return nil, err
	}
	if st.IsDir() {
		_ = f.Close()
		return nil, fs.ErrNotExist
	}
	return f, nil
}

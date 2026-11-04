package storage

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"regexp"

	"github.com/KarpelesLab/gowebp"
	"github.com/disintegration/imaging"
)

var base64Regex = regexp.MustCompile(`^data:image\/[a-zA-Z0-9\+\-]+;base64,(.+)$`)

type ProcessedImage struct {
	Data        []byte
	Format      string
	ContentType string
	Width       int
	Height      int
}

// DecodeBase64OrBytes decodes a base64 data URI string or raw bytes into standard []byte
func DecodeBase64OrBytes(input string) ([]byte, error) {
	clean := input
	matches := base64Regex.FindStringSubmatch(input)
	if len(matches) == 2 {
		clean = matches[1]
	}

	data, err := base64.StdEncoding.DecodeString(clean)
	if err == nil && len(data) > 0 {
		return data, nil
	}

	// Try URL safe encoding as fallback
	dataURL, errURL := base64.URLEncoding.DecodeString(clean)
	if errURL == nil && len(dataURL) > 0 {
		return dataURL, nil
	}

	return nil, errors.New("gagal memproses data base64 gambar")
}

// ProcessAndConvertToWebP resizes image to max bounds (1280x720 or 720x1280 for portrait),
// preserves aspect ratio, and encodes to optimized WebP format.
func ProcessAndConvertToWebP(rawBytes []byte, maxWidth, maxHeight int, quality float32) (*ProcessedImage, error) {
	if len(rawBytes) == 0 {
		return nil, errors.New("data gambar kosong")
	}

	// 1. Decode image from bytes with auto EXIF orientation
	img, err := imaging.Decode(bytes.NewReader(rawBytes), imaging.AutoOrientation(true))
	if err != nil {
		return nil, fmt.Errorf("format gambar tidak dikenali: %w", err)
	}

	bounds := img.Bounds()
	srcWidth := bounds.Dx()
	srcHeight := bounds.Dy()

	// 2. Adjust target bounding box for landscape vs portrait orientation
	targetW := maxWidth
	targetH := maxHeight
	if srcHeight > srcWidth && maxHeight < maxWidth {
		// Portrait image: flip target bounding box so portrait isn't squashed into landscape box
		targetW = maxHeight
		targetH = maxWidth
	}

	// 3. Resize proportionally if dimensions exceed target box
	var resized image.Image = img
	if srcWidth > targetW || srcHeight > targetH {
		resized = imaging.Fit(img, targetW, targetH, imaging.Lanczos)
	}

	// 4. Encode to WebP format
	var outBuf bytes.Buffer
	webpOpts := &gowebp.Options{
		Lossy:   true,
		Quality: quality,
	}

	if err := gowebp.Encode(&outBuf, resized, webpOpts); err != nil {
		return nil, fmt.Errorf("gagal mengonversi gambar ke WebP: %w", err)
	}

	finalBounds := resized.Bounds()
	return &ProcessedImage{
		Data:        outBuf.Bytes(),
		Format:      "webp",
		ContentType: "image/webp",
		Width:       finalBounds.Dx(),
		Height:      finalBounds.Dy(),
	}, nil
}


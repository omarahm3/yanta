// Package asset handles storage and management of binary assets like images and files.
package asset

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Asset struct {
	Hash      string
	Ext       string
	Bytes     int64
	MIME      string
	CreatedAt time.Time
}

type AssetInfo struct {
	Hash         string
	Ext          string
	Bytes        int64
	MIME         string
	AlreadyExist bool
}

func ComputeHash(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func ValidateHash(hash string) error {
	if len(hash) != 64 {
		return fmt.Errorf("invalid hash length: got %d, want 64", len(hash))
	}

	for _, r := range hash {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) {
			return fmt.Errorf("invalid hash character: %c (must be 0-9a-f)", r)
		}
	}

	return nil
}

func ValidateExtension(ext string) error {
	if ext == "" {
		return nil
	}

	if !strings.HasPrefix(ext, ".") {
		return fmt.Errorf("extension must start with dot, got: %s", ext)
	}

	if len(ext) < 2 || len(ext) > 10 {
		return fmt.Errorf("extension length invalid: %d chars", len(ext))
	}

	for i, r := range ext {
		if i == 0 {
			continue
		}
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')) {
			return fmt.Errorf("extension contains invalid character: %c", r)
		}
	}

	return nil
}

func NormalizeExtension(ext string) string {
	ext = strings.ToLower(ext)
	if ext != "" && !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	return ext
}

func (a *Asset) Validate() error {
	if err := ValidateHash(a.Hash); err != nil {
		return fmt.Errorf("hash: %w", err)
	}

	if err := ValidateExtension(a.Ext); err != nil {
		return fmt.Errorf("extension: %w", err)
	}

	if a.Bytes <= 0 {
		return fmt.Errorf("bytes must be > 0, got: %d", a.Bytes)
	}

	if a.MIME == "" {
		return fmt.Errorf("MIME type cannot be empty")
	}

	if a.CreatedAt.IsZero() {
		return fmt.Errorf("created_at cannot be zero")
	}

	return nil
}

func DetectMIME(ext string) string {
	ext = strings.ToLower(ext)

	mimeMap := map[string]string{
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".webp": "image/webp",
		".svg":  "image/svg+xml",
		".pdf":  "application/pdf",
		".mp4":  "video/mp4",
		".webm": "video/webm",
		".mp3":  "audio/mpeg",
		".wav":  "audio/wav",
		".txt":  "text/plain",
		".md":   "text/markdown",
		".json": "application/json",
		".xml":  "application/xml",
		".zip":  "application/zip",
		".tar":  "application/x-tar",
		".gz":   "application/gzip",
	}

	if mime, ok := mimeMap[ext]; ok {
		return mime
	}

	return "application/octet-stream"
}

func detectImageExt(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	c := http.DetectContentType(data)
	switch c {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	default:
		return ""
	}
}

// ParseDataURL parses a data URL (e.g., "data:image/png;base64,iVBORw0KGgo...")
// and returns the MIME type and decoded bytes.
func ParseDataURL(dataURL string) (mimeType string, data []byte, err error) {
	if !strings.HasPrefix(dataURL, "data:") {
		return "", nil, fmt.Errorf("not a data URL")
	}

	parts := strings.SplitN(dataURL[5:], ",", 2)
	if len(parts) != 2 {
		return "", nil, fmt.Errorf("invalid data URL format")
	}

	header := parts[0]
	payload := parts[1]

	// header is "<mime>[;param=value...][;base64]". The MIME is the first
	// segment; the base64 marker may sit after optional parameters (e.g.
	// "image/png;charset=utf-8;base64"), so scan all segments for it rather than
	// assuming it's exactly the second.
	headerParts := strings.Split(header, ";")
	mimeType = headerParts[0]
	isBase64 := false
	for _, p := range headerParts[1:] {
		if strings.EqualFold(strings.TrimSpace(p), "base64") {
			isBase64 = true
			break
		}
	}
	if !isBase64 {
		return "", nil, fmt.Errorf("only base64 data URLs are supported")
	}

	data, err = base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return "", nil, fmt.Errorf("decoding base64: %w", err)
	}

	return mimeType, data, nil
}

// EncodeDataURL encodes data as a data URL with the given MIME type.
func EncodeDataURL(mimeType string, data []byte) string {
	encoded := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, encoded)
}

// MIMEToExtension converts a MIME type to a file extension. Deliberately raster
// image types only — SVG is excluded because it can carry embedded script
// (stored-XSS if ever rendered inline), matching Upload's allowlist.
func MIMEToExtension(mime string) string {
	mimeMap := map[string]string{
		"image/png":  ".png",
		"image/jpeg": ".jpg",
		"image/gif":  ".gif",
		"image/webp": ".webp",
	}
	if ext, ok := mimeMap[mime]; ok {
		return ext
	}
	return ""
}

// ParseAssetRef parses an asset reference in the format "/assets/{projectAlias}/{hash}{ext}"
// and returns the hash and extension.
func ParseAssetRef(ref string) (hash string, ext string, err error) {
	if !strings.HasPrefix(ref, "/assets/") {
		return "", "", fmt.Errorf("not an asset reference")
	}

	// Remove "/assets/" prefix
	remainder := ref[8:]

	// Find the next "/" to separate projectAlias from the rest
	slashIdx := strings.Index(remainder, "/")
	if slashIdx == -1 {
		return "", "", fmt.Errorf("invalid asset reference format")
	}

	// Skip projectAlias and get the filename part
	filename := remainder[slashIdx+1:]

	// Filename should be "{hash}{ext}" where hash is 64 chars
	if len(filename) < 64 {
		return "", "", fmt.Errorf("invalid asset reference: hash too short")
	}

	hash = filename[:64]
	ext = filename[64:]

	if err := ValidateHash(hash); err != nil {
		return "", "", fmt.Errorf("invalid hash: %w", err)
	}

	if ext != "" {
		if err := ValidateExtension(ext); err != nil {
			return "", "", fmt.Errorf("invalid extension: %w", err)
		}
	}

	return hash, ext, nil
}

// ParseVaultRef parses a vault reference (e.g., "vault://abc123.png")
// and returns the hash and extension.
func ParseVaultRef(ref string) (hash string, ext string, err error) {
	if !strings.HasPrefix(ref, "vault://") {
		return "", "", fmt.Errorf("not a vault reference")
	}

	remainder := ref[8:]
	if len(remainder) < 64 {
		return "", "", fmt.Errorf("invalid vault reference: hash too short")
	}

	hash = remainder[:64]
	ext = remainder[64:]

	if err := ValidateHash(hash); err != nil {
		return "", "", fmt.Errorf("invalid hash: %w", err)
	}

	if ext != "" {
		if err := ValidateExtension(ext); err != nil {
			return "", "", fmt.Errorf("invalid extension: %w", err)
		}
	}

	return hash, ext, nil
}

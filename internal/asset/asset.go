package asset

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
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

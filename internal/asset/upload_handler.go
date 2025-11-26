package asset

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"yanta/internal/logger"
)

const (
	MaxUploadSize    = 10 * 1024 * 1024
	FormFieldProject = "project"
	FormFieldFile    = "file"
)

type UploadResponse struct {
	Success bool   `json:"success"`
	Hash    string `json:"hash,omitempty"`
	Ext     string `json:"ext,omitempty"`
	URL     string `json:"url,omitempty"`
	Bytes   int64  `json:"bytes,omitempty"`
	MIME    string `json:"mime,omitempty"`
	Error   string `json:"error,omitempty"`
}

// UploadHandler handles HTTP file uploads, bypassing Wails RPC URL length limits.
type UploadHandler struct {
	service *Service
}

func NewUploadHandler(service *Service) *UploadHandler {
	return &UploadHandler{service: service}
}

func (h *UploadHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		h.sendError(w, http.StatusMethodNotAllowed, "method not allowed: use POST")
		return
	}

	if err := r.ParseMultipartForm(MaxUploadSize + 1024); err != nil {
		logger.WithError(err).Debug("failed to parse multipart form")
		h.sendError(w, http.StatusBadRequest, "invalid multipart form: "+err.Error())
		return
	}

	projectAlias := strings.TrimSpace(r.FormValue(FormFieldProject))
	if projectAlias == "" {
		h.sendError(w, http.StatusBadRequest, "project field is required")
		return
	}

	file, header, err := r.FormFile(FormFieldFile)
	if err != nil {
		logger.WithError(err).Debug("failed to get file from form")
		h.sendError(w, http.StatusBadRequest, "file field is required: "+err.Error())
		return
	}
	defer file.Close()

	logger.WithFields(map[string]any{
		"project":  projectAlias,
		"filename": header.Filename,
		"size":     header.Size,
	}).Debug("HTTP upload request received")

	data, err := io.ReadAll(io.LimitReader(file, MaxUploadSize+1))
	if err != nil {
		logger.WithError(err).Error("failed to read uploaded file")
		h.sendError(w, http.StatusInternalServerError, "failed to read file")
		return
	}

	if int64(len(data)) > MaxUploadSize {
		h.sendError(w, http.StatusBadRequest, fmt.Sprintf("file too large: max %dMB", MaxUploadSize/(1024*1024)))
		return
	}

	if len(data) == 0 {
		h.sendError(w, http.StatusBadRequest, "file is empty")
		return
	}

	ctx := context.Background()
	info, err := h.service.Upload(ctx, projectAlias, data, header.Filename)
	if err != nil {
		logger.WithError(err).WithFields(map[string]any{
			"project":  projectAlias,
			"filename": header.Filename,
			"size":     len(data),
		}).Error("upload service failed")
		h.sendError(w, http.StatusBadRequest, err.Error())
		return
	}

	url, err := h.service.BuildURL(ctx, projectAlias, info.Hash, info.Ext)
	if err != nil {
		logger.WithError(err).Error("failed to build asset URL")
		h.sendError(w, http.StatusInternalServerError, "failed to build URL")
		return
	}

	logger.WithFields(map[string]any{
		"project":  projectAlias,
		"hash":     info.Hash,
		"ext":      info.Ext,
		"bytes":    info.Bytes,
		"duration": time.Since(startTime).String(),
	}).Info("HTTP upload completed successfully")

	h.sendSuccess(w, UploadResponse{
		Success: true,
		Hash:    info.Hash,
		Ext:     info.Ext,
		URL:     url,
		Bytes:   info.Bytes,
		MIME:    info.MIME,
	})
}

func (h *UploadHandler) sendError(w http.ResponseWriter, status int, message string) {
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(UploadResponse{
		Success: false,
		Error:   message,
	})
}

func (h *UploadHandler) sendSuccess(w http.ResponseWriter, response UploadResponse) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

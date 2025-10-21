package logger

import (
	"github.com/wailsapp/wails/v2/pkg/logger"
)

type WailsLogger struct{}

func NewWailsLogger() logger.Logger {
	return &WailsLogger{}
}

func (w *WailsLogger) Print(message string) {
	GetLogger().Print(message)
}

func (w *WailsLogger) Trace(message string) {
	GetLogger().Trace(message)
}

func (w *WailsLogger) Debug(message string) {
	GetLogger().Debug(message)
}

func (w *WailsLogger) Info(message string) {
	GetLogger().Info(message)
}

func (w *WailsLogger) Warning(message string) {
	GetLogger().Warn(message)
}

func (w *WailsLogger) Error(message string) {
	GetLogger().Error(message)
}

func (w *WailsLogger) Fatal(message string) {
	GetLogger().Fatal(message)
}

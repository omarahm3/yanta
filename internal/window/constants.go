// Package window provides window configuration and management constants.
package window

import (
	"yanta/internal/config"
)

const (
	DefaultWidth  = 1024
	DefaultHeight = 768
)

const (
	MinWidth  = 400
	MinHeight = 300
)

const (
	MaxWidth  = 0
	MaxHeight = 0
)

type Config struct {
	DefaultWidth  int    `json:"defaultWidth"`
	DefaultHeight int    `json:"defaultHeight"`
	MinWidth      int    `json:"minWidth"`
	MinHeight     int    `json:"minHeight"`
	MaxWidth      int    `json:"maxWidth"`
	MaxHeight     int    `json:"maxHeight"`
	WindowMode    string `json:"windowMode"`
	IsFrameless   bool   `json:"isFrameless"`
}

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) GetConfig() Config {
	return Config{
		DefaultWidth:  DefaultWidth,
		DefaultHeight: DefaultHeight,
		MinWidth:      MinWidth,
		MinHeight:     MinHeight,
		MaxWidth:      MaxWidth,
		MaxHeight:     MaxHeight,
		WindowMode:    config.GetLinuxWindowMode(),
		IsFrameless:   config.IsLinuxFrameless(),
	}
}

func (s *Service) GetWindowMode() string {
	return config.GetLinuxWindowMode()
}

func (s *Service) SetWindowMode(mode string) error {
	return config.SetLinuxWindowMode(mode)
}

func (s *Service) IsFrameless() bool {
	return config.IsLinuxFrameless()
}

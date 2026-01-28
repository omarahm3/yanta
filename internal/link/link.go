// Package link handles URL and document link parsing and storage.
package link

import (
	"fmt"
	"net/url"
	"strings"
)

const (
	MaxURLLength = 2048
)

type Link struct {
	URL  string
	Host string
}

func New(rawURL string) (*Link, error) {
	if err := ValidateURL(rawURL); err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	host, err := ExtractHost(rawURL)
	if err != nil {
		return nil, fmt.Errorf("extracting host: %w", err)
	}

	return &Link{
		URL:  rawURL,
		Host: host,
	}, nil
}

func ValidateURL(rawURL string) error {
	rawURL = strings.TrimSpace(rawURL)

	if rawURL == "" {
		return fmt.Errorf("URL cannot be empty")
	}

	if len(rawURL) > MaxURLLength {
		return fmt.Errorf("URL too long: %d characters (max %d)", len(rawURL), MaxURLLength)
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("parsing URL: %w", err)
	}

	if parsed.Scheme == "" {
		return fmt.Errorf("URL must have a scheme (http:// or https://)")
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("invalid scheme %q (must be http or https)", parsed.Scheme)
	}

	if parsed.Host == "" {
		return fmt.Errorf("URL must have a host")
	}

	return nil
}

func ExtractHost(rawURL string) (string, error) {
	rawURL = strings.TrimSpace(rawURL)

	if rawURL == "" {
		return "", fmt.Errorf("URL cannot be empty")
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("parsing URL: %w", err)
	}

	if parsed.Host == "" {
		return "", fmt.Errorf("URL has no host")
	}

	host := parsed.Hostname()
	if host == "" {
		host = parsed.Host
	}

	return host, nil
}

func NormalizeURL(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)

	if strings.HasSuffix(rawURL, "/") && len(rawURL) > 1 {
		parsed, err := url.Parse(rawURL)
		if err == nil && parsed.Path != "/" {
			rawURL = strings.TrimSuffix(rawURL, "/")
		} else if err == nil && parsed.Path == "/" && parsed.RawQuery == "" && parsed.Fragment == "" {
			rawURL = strings.TrimSuffix(rawURL, "/")
		}
	}

	return rawURL
}

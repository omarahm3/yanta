package link

import (
	"strings"
	"testing"
)

// ==================== Link Creation Tests ====================

func TestNew(t *testing.T) {
	tests := []struct {
		name      string
		url       string
		wantHost  string
		wantError bool
	}{
		{
			name:     "valid https URL",
			url:      "https://github.com/user/repo",
			wantHost: "github.com",
		},
		{
			name:     "valid http URL",
			url:      "http://example.com/page",
			wantHost: "example.com",
		},
		{
			name:     "URL with port",
			url:      "https://localhost:8080/api",
			wantHost: "localhost",
		},
		{
			name:     "URL with subdomain",
			url:      "https://api.github.com/repos",
			wantHost: "api.github.com",
		},
		{
			name:     "URL with path and query",
			url:      "https://example.com/path?query=value",
			wantHost: "example.com",
		},
		{
			name:     "URL with fragment",
			url:      "https://example.com/page#section",
			wantHost: "example.com",
		},
		{
			name:      "empty URL",
			url:       "",
			wantError: true,
		},
		{
			name:      "invalid URL - no scheme",
			url:       "example.com",
			wantError: true,
		},
		{
			name:      "invalid URL - invalid scheme",
			url:       "ftp://example.com",
			wantError: true,
		},
		{
			name:      "URL too long",
			url:       "https://example.com/" + string(make([]byte, 2100)),
			wantError: true,
		},
		{
			name:      "whitespace URL",
			url:       "   ",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			link, err := New(tt.url)

			if tt.wantError {
				if err == nil {
					t.Errorf("New() expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("New() unexpected error: %v", err)
				return
			}

			if link.URL != tt.url {
				t.Errorf("link.URL = %q, want %q", link.URL, tt.url)
			}

			if link.Host != tt.wantHost {
				t.Errorf("link.Host = %q, want %q", link.Host, tt.wantHost)
			}
		})
	}
}

// ==================== URL Validation Tests ====================

func TestValidateURL(t *testing.T) {
	tests := []struct {
		name      string
		url       string
		wantError bool
	}{
		{
			name: "valid https",
			url:  "https://example.com",
		},
		{
			name: "valid http",
			url:  "http://example.com",
		},
		{
			name:      "empty URL",
			url:       "",
			wantError: true,
		},
		{
			name:      "only whitespace",
			url:       "   \t\n  ",
			wantError: true,
		},
		{
			name:      "no scheme",
			url:       "example.com/path",
			wantError: true,
		},
		{
			name:      "ftp scheme",
			url:       "ftp://example.com",
			wantError: true,
		},
		{
			name:      "file scheme",
			url:       "file:///path/to/file",
			wantError: true,
		},
		{
			name:      "URL too long",
			url:       "https://example.com/" + string(make([]byte, 2100)),
			wantError: true,
		},
		{
			name: "max length URL",
			url:  "https://example.com/" + strings.Repeat("a", 2000),
		},
		{
			name:      "invalid characters",
			url:       "https://exam ple.com",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateURL(tt.url)

			if tt.wantError {
				if err == nil {
					t.Errorf("ValidateURL() expected error but got nil")
				}
			} else {
				if err != nil {
					t.Errorf("ValidateURL() unexpected error: %v", err)
				}
			}
		})
	}
}

// ==================== Host Extraction Tests ====================

func TestExtractHost(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		wantHost string
		wantErr  bool
	}{
		{
			name:     "simple domain",
			url:      "https://example.com",
			wantHost: "example.com",
		},
		{
			name:     "with port",
			url:      "https://example.com:8080",
			wantHost: "example.com",
		},
		{
			name:     "with subdomain",
			url:      "https://api.github.com",
			wantHost: "api.github.com",
		},
		{
			name:     "with path",
			url:      "https://example.com/path/to/resource",
			wantHost: "example.com",
		},
		{
			name:     "localhost",
			url:      "http://localhost:3000",
			wantHost: "localhost",
		},
		{
			name:     "IP address",
			url:      "http://192.168.1.1",
			wantHost: "192.168.1.1",
		},
		{
			name:    "invalid URL",
			url:     "not-a-url",
			wantErr: true,
		},
		{
			name:    "empty URL",
			url:     "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			host, err := ExtractHost(tt.url)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ExtractHost() expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("ExtractHost() unexpected error: %v", err)
				return
			}

			if host != tt.wantHost {
				t.Errorf("ExtractHost() = %q, want %q", host, tt.wantHost)
			}
		})
	}
}

// ==================== Normalization Tests ====================

func TestNormalizeURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want string
	}{
		{
			name: "already normalized",
			url:  "https://example.com/path",
			want: "https://example.com/path",
		},
		{
			name: "remove trailing slash",
			url:  "https://example.com/",
			want: "https://example.com",
		},
		{
			name: "remove trailing slash from path",
			url:  "https://example.com/path/",
			want: "https://example.com/path",
		},
		{
			name: "trim whitespace",
			url:  "  https://example.com  ",
			want: "https://example.com",
		},
		{
			name: "preserve query params",
			url:  "https://example.com/path?key=value",
			want: "https://example.com/path?key=value",
		},
		{
			name: "preserve fragment",
			url:  "https://example.com/path#section",
			want: "https://example.com/path#section",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeURL(tt.url)
			if got != tt.want {
				t.Errorf("NormalizeURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

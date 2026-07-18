package system

import (
	"reflect"
	"testing"
)

func TestPickImageMIMEs(t *testing.T) {
	tests := []struct {
		name    string
		offered []string
		want    []string
	}{
		{
			name:    "empty clipboard",
			offered: nil,
			want:    nil,
		},
		{
			name:    "no image types",
			offered: []string{"text/plain", "text/html"},
			want:    nil,
		},
		{
			name:    "preferred type ordering wins over offered ordering",
			offered: []string{"image/webp", "image/png", "text/html"},
			want:    []string{"image/png", "image/webp"},
		},
		{
			name:    "nonstandard image types appended after preferred",
			offered: []string{"image/jpg", "image/png", "image/bmp"},
			want:    []string{"image/png", "image/jpg", "image/bmp"},
		},
		{
			name:    "only nonstandard image type still reads",
			offered: []string{"text/plain", "image/bmp"},
			want:    []string{"image/bmp"},
		},
		{
			name:    "duplicates collapse",
			offered: []string{"image/png", "image/png", "image/jpeg"},
			want:    []string{"image/png", "image/jpeg"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := pickImageMIMEs(tt.offered)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("pickImageMIMEs(%v) = %v, want %v", tt.offered, got, tt.want)
			}
		})
	}
}

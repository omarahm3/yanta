package project

import (
	"testing"
)

func TestValidateAlias_WithAtSymbol(t *testing.T) {
	tests := []struct {
		name    string
		alias   string
		wantErr bool
	}{
		{
			name:    "invalid alias without @ prefix",
			alias:   "lps",
			wantErr: true,
		},
		{
			name:    "valid alias with @ prefix",
			alias:   "@lps",
			wantErr: false,
		},
		{
			name:    "valid alias @work",
			alias:   "@work",
			wantErr: false,
		},
		{
			name:    "valid alias @side",
			alias:   "@side",
			wantErr: false,
		},
		{
			name:    "valid alias with hyphens",
			alias:   "@my-project",
			wantErr: false,
		},
		{
			name:    "invalid: too short with @",
			alias:   "@a",
			wantErr: true,
		},
		{
			name:    "invalid: special chars",
			alias:   "@work!",
			wantErr: true,
		},
		{
			name:    "invalid: uppercase",
			alias:   "@Work",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateAlias(tt.alias)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAlias(%q) error = %v, wantErr %v", tt.alias, err, tt.wantErr)
			}
		})
	}
}

func TestNormalizeAlias_WithAtSymbol(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "preserve @ prefix",
			input: "@Work Project",
			want:  "@work-project",
		},
		{
			name:  "preserve @ with spaces",
			input: "@My Cool Project",
			want:  "@my-cool-project",
		},
		{
			name:  "without @ prefix",
			input: "Work Project",
			want:  "@work-project",
		},
		{
			name:  "@ with underscores",
			input: "@work_project",
			want:  "@work-project",
		},
		{
			name:  "trim @ prefix hyphens",
			input: "@-work-project-",
			want:  "@work-project",
		},
		{
			name:  "remove invalid characters",
			input: "Work!",
			want:  "@work",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeAlias(tt.input)
			if got != tt.want {
				t.Errorf("NormalizeAlias(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

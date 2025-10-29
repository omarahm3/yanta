package strutil

import "testing"

func TestToTitle(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "simple lowercase",
			input: "hello world",
			want:  "Hello World",
		},
		{
			name:  "all uppercase",
			input: "HELLO WORLD",
			want:  "Hello World",
		},
		{
			name:  "mixed case",
			input: "HeLLo WoRLd",
			want:  "Hello World",
		},
		{
			name:  "with hyphens",
			input: "hello-world-test",
			want:  "Hello-World-Test",
		},
		{
			name:  "with underscores",
			input: "hello_world_test",
			want:  "Hello_World_Test",
		},
		{
			name:  "multiple spaces",
			input: "hello   world",
			want:  "Hello   World",
		},
		{
			name:  "mixed separators",
			input: "hello-world test_case",
			want:  "Hello-World Test_Case",
		},
		{
			name:  "empty string",
			input: "",
			want:  "",
		},
		{
			name:  "single character",
			input: "a",
			want:  "A",
		},
		{
			name:  "numbers",
			input: "test123case",
			want:  "Test123case",
		},
		{
			name:  "numbers at start",
			input: "123test",
			want:  "123test",
		},
		{
			name:  "punctuation",
			input: "hello, world!",
			want:  "Hello, World!",
		},
		{
			name:  "unicode characters",
			input: "café résumé",
			want:  "Café Résumé",
		},
		{
			name:  "real project alias example",
			input: "my-awesome-project",
			want:  "My-Awesome-Project",
		},
		{
			name:  "only separators",
			input: "---",
			want:  "---",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ToTitle(tt.input)
			if got != tt.want {
				t.Errorf("ToTitle(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

package search

import (
	"testing"
)

func TestParse(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantFTS5 string
	}{
		// === Basic Terms ===
		{
			name:     "simple term",
			input:    "meeting",
			wantFTS5: "(title:meeting OR body:meeting)",
		},
		{
			name:     "multiple terms implicit AND",
			input:    "project timeline",
			wantFTS5: "(title:project OR body:project) AND (title:timeline OR body:timeline)",
		},
		{
			name:     "exact phrase",
			input:    `"pull request"`,
			wantFTS5: `(title:"pull request" OR body:"pull request")`,
		},
		{
			name:     "prefix search",
			input:    "cook*",
			wantFTS5: "(title:cook* OR body:cook*)",
		},

		// === Filters ===
		{
			name:     "project filter",
			input:    "project:work",
			wantFTS5: `"*"`,
		},
		{
			name:     "tag filter with #",
			input:    "tag:#meeting",
			wantFTS5: `"*"`,
		},
		{
			name:     "tag filter without #",
			input:    "tag:meeting",
			wantFTS5: `"*"`,
		},
		{
			name:     "multiple tags",
			input:    "tag:#code tag:#review",
			wantFTS5: `"*"`,
		},
		{
			name:     "mixed filters and terms",
			input:    "project:test tag:#design architecture",
			wantFTS5: `(title:architecture OR body:architecture)`,
		},

		// === Scope Filters ===
		{
			name:     "in title scope",
			input:    "in:title Notes",
			wantFTS5: "title:Notes",
		},
		{
			name:     "in body scope",
			input:    "in:body authentication",
			wantFTS5: "body:authentication",
		},
		{
			name:     "scope with multiple terms",
			input:    "in:title API security",
			wantFTS5: "title:API AND title:security",
		},
		{
			name:     "direct title filter",
			input:    "title:Kickoff",
			wantFTS5: "title:Kickoff",
		},
		{
			name:     "direct body filter",
			input:    "body:meeting",
			wantFTS5: "body:meeting",
		},

		// === Negation ===
		{
			name:     "negation with term",
			input:    "project -work",
			wantFTS5: "(title:project OR body:project) NOT (title:work OR body:work)",
		},
		{
			name:     "multiple negations",
			input:    "Go -Java -Python",
			wantFTS5: "(title:Go OR body:Go) NOT (title:Java OR body:Java) NOT (title:Python OR body:Python)",
		},

		// === OR Operator ===
		{
			name:     "simple OR",
			input:    "Go OR JavaScript",
			wantFTS5: "(title:Go OR body:Go) OR (title:JavaScript OR body:JavaScript)",
		},
		{
			name:     "OR with phrases",
			input:    `"pull request" OR "merge request"`,
			wantFTS5: `(title:"pull request" OR body:"pull request") OR (title:"merge request" OR body:"merge request")`,
		},
		{
			name:     "multiple OR",
			input:    "Go OR JavaScript OR Python",
			wantFTS5: "(title:Go OR body:Go) OR (title:JavaScript OR body:JavaScript) OR (title:Python OR body:Python)",
		},

		// === AND Operator ===
		{
			name:     "explicit AND",
			input:    "Go AND JavaScript",
			wantFTS5: "(title:Go OR body:Go) AND (title:JavaScript OR body:JavaScript)",
		},

		// === Operator Precedence (AND higher than OR) ===
		{
			name:     "OR and AND precedence - A OR B AND C",
			input:    "API OR security AND authentication",
			wantFTS5: "(title:API OR body:API) OR ((title:security OR body:security) AND (title:authentication OR body:authentication))",
		},
		{
			name:     "OR and AND precedence - A AND B OR C",
			input:    "API AND security OR authentication",
			wantFTS5: "((title:API OR body:API) AND (title:security OR body:security)) OR (title:authentication OR body:authentication)",
		},

		// === Operators with Filters ===
		{
			name:     "filter with OR",
			input:    "project:test Go OR JavaScript",
			wantFTS5: "(title:Go OR body:Go) OR (title:JavaScript OR body:JavaScript)",
		},
		{
			name:     "filter with explicit AND",
			input:    "project:test AND design",
			wantFTS5: "(title:design OR body:design)",
		},
		{
			name:     "tag with OR",
			input:    "tag:#urgent OR tag:#important",
			wantFTS5: `"*"`,
		},

		// === Operators with Scope ===
		{
			name:     "scope with OR",
			input:    "in:title API OR SDK",
			wantFTS5: "title:API OR title:SDK",
		},
		{
			name:     "scope with AND",
			input:    "in:body security AND authentication",
			wantFTS5: "body:security AND body:authentication",
		},

		// === Operators with Negation ===
		{
			name:     "OR with negation",
			input:    "Go OR -JavaScript",
			wantFTS5: "(title:Go OR body:Go) OR NOT (title:JavaScript OR body:JavaScript)",
		},
		{
			name:     "AND with negation",
			input:    "Go AND -JavaScript",
			wantFTS5: "(title:Go OR body:Go) NOT (title:JavaScript OR body:JavaScript)",
		},

		// === Complex Queries ===
		{
			name:     "complex mixed query",
			input:    "project:work tag:#urgent API AND security OR authentication",
			wantFTS5: `((title:API OR body:API) AND (title:security OR body:security)) OR (title:authentication OR body:authentication)`,
		},
		{
			name:     "filter with implicit and explicit AND",
			input:    "project:test design AND review",
			wantFTS5: "(title:design OR body:design) AND (title:review OR body:review)",
		},

		// === Edge Cases ===
		{
			name:     "empty query",
			input:    "",
			wantFTS5: `"*"`,
		},
		{
			name:     "whitespace only",
			input:    "   ",
			wantFTS5: `"*"`,
		},
		{
			name:     "OR as a search term in project",
			input:    "project:OR",
			wantFTS5: `"*"`,
		},
		{
			name:     "AND as a search term in tag",
			input:    "tag:AND",
			wantFTS5: `"*"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query, err := Parse(tt.input)
			if err != nil {
				t.Fatalf("Parse() error = %v", err)
			}

			got := query.ToFTS5()
			if got != tt.wantFTS5 {
				t.Errorf("ToFTS5() = %q, want %q", got, tt.wantFTS5)
			}
		})
	}
}

func TestParseErrors(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "unclosed quote",
			input: `"unclosed`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Parse(tt.input)
			if err == nil {
				t.Errorf("Parse() expected error for input %q", tt.input)
			}
		})
	}
}

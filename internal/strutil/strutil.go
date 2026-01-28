// Package strutil provides string manipulation utilities.
package strutil

import (
	"strings"
	"unicode"
)

// ToTitle converts a string to title case, capitalizing the first letter of each word.
// Words are separated by spaces, hyphens, underscores, or other non-alphanumeric characters.
// This is a replacement for the deprecated strings.Title function with proper Unicode handling.
//
// Example: "hello-world test" -> "Hello-World Test"
func ToTitle(s string) string {
	s = strings.ToLower(s)
	runes := []rune(s)
	if len(runes) == 0 {
		return s
	}

	inWord := false
	for i, r := range runes {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			if !inWord {
				runes[i] = unicode.ToUpper(r)
				inWord = true
			}
		} else {
			inWord = false
		}
	}

	return string(runes)
}

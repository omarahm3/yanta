package commandline

import (
	"fmt"
	"regexp"
	"strings"
)

func ExtractDates(commandText string) []string {
	datePattern := regexp.MustCompile(`(\d{1,2}-\d{1,2}-\d{4}|\d{4}-\d{2}-\d{2})`)
	matches := datePattern.FindAllString(commandText, -1)
	if matches == nil {
		return []string{}
	}
	return matches
}

func FormatDate(dateStr string) string {
	if strings.Contains(dateStr, "-") {
		parts := strings.Split(dateStr, "-")
		if len(parts) == 3 && len(parts[0]) <= 2 {
			day := parts[0]
			month := parts[1]
			year := parts[2]
			if len(day) == 1 {
				day = "0" + day
			}
			if len(month) == 1 {
				month = "0" + month
			}
			return fmt.Sprintf("%s-%s-%s", year, month, day)
		}
	}
	return dateStr
}

func RemoveDatesFromText(commandText string) string {
	dates := ExtractDates(commandText)
	textWithoutDates := commandText
	for _, date := range dates {
		textWithoutDates = strings.ReplaceAll(textWithoutDates, date, "")
	}
	return strings.TrimSpace(textWithoutDates)
}

func formatCommand(command, pattern string) string {
	return fmt.Sprintf("^%s%s", command, strings.ReplaceAll(pattern, " ", "\\s+"))
}

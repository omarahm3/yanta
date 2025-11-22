package search

import (
	"strings"

	"yanta/internal/logger"
)

func (q *Query) ToFTS5() string {
	logger.Debug("converting query to fts5")

	if q == nil || q.Expression == nil {
		logger.Debug("query or expression is nil, returning wildcard match")
		return `"*"`
	}

	result := q.Expression.toFTS5("")
	logger.Debugf("query converted to fts5 successfully result=%s", result)
	return result
}

func (o *OrExpression) toFTS5(scope string) string {
	logger.Debugf("converting or expression to fts5 scope=%s andCount=%d", scope, len(o.And))

	if len(o.And) == 0 {
		logger.Debug("no and expressions found, returning wildcard match")
		return `"*"`
	}

	var commonFilters []*Item
	inheritedScope := scope

	if len(o.And) > 1 {
		logger.Debug("multiple and expressions found, extracting common filters")
		hasTerms := false
		var leadingFilters []*Item

		for _, item := range o.And[0].Items {
			if item.Filter != nil {
				key := strings.ToLower(item.Filter.Key)
				if key == "project" || key == "tag" {
					if !hasTerms {
						leadingFilters = append(leadingFilters, item)
						var valStr string
						if item.Filter.Value != nil {
							valStr = *item.Filter.Value
						}
						logger.Debugf("added leading filter key=%s value=%s", key, valStr)
					}
				} else if key == "in" {
					if !hasTerms && item.Filter.Value != nil {
						scopeVal := strings.ToLower(*item.Filter.Value)
						if scopeVal == "title" || scopeVal == "body" {
							inheritedScope = scopeVal
							logger.Debugf("inherited scope changed to %s", inheritedScope)
						}
					}
				} else {
					break
				}
			} else {
				hasTerms = true
				break
			}
		}

		if hasTerms {
			commonFilters = leadingFilters
			logger.Debugf("using %d common filters", len(commonFilters))
		}
	}

	var orParts []string
	for i, andExpr := range o.And {
		logger.Debugf("processing and expression %d/%d", i+1, len(o.And))
		var items []*Item

		if len(commonFilters) > 0 {
			items = append(items, commonFilters...)
			logger.Debugf("added %d common filters to branch", len(commonFilters))
		}

		startIdx := 0
		if i == 0 {
			if len(commonFilters) > 0 {
				startIdx = len(commonFilters)
				logger.Debugf("first branch: skipping %d common filters", len(commonFilters))
			}
			if inheritedScope != scope {
				for j, item := range andExpr.Items {
					if item.Filter != nil && strings.ToLower(item.Filter.Key) == "in" {
						startIdx = j + 1
						logger.Debugf("first branch: skipping scope filter at index %d", j)
						break
					}
				}
			}
		}

		items = append(items, andExpr.Items[startIdx:]...)
		logger.Debugf("processing %d items for branch with scope=%s", len(items), inheritedScope)

		if part := convertItems(items, inheritedScope); part != "" {
			orParts = append(orParts, part)
			logger.Debugf("branch converted successfully part=%s", part)
		} else {
			logger.Debug("branch resulted in empty part, skipping")
		}
	}

	if len(orParts) == 0 {
		logger.Debug("no valid parts generated, returning wildcard match")
		return `"*"`
	}

	if len(orParts) == 1 {
		logger.Debugf("single part generated, returning directly part=%s", orParts[0])
		return orParts[0]
	}

	logger.Debugf("joining %d parts with OR", len(orParts))
	var result strings.Builder
	for i, part := range orParts {
		if i > 0 {
			result.WriteString(" OR ")
		}
		if needsParens(part) {
			result.WriteString("(")
			result.WriteString(part)
			result.WriteString(")")
			logger.Debugf("wrapped part %d in parentheses", i+1)
		} else {
			result.WriteString(part)
		}
	}

	finalResult := result.String()
	logger.Debugf("or expression converted to fts5 successfully result=%s", finalResult)
	return finalResult
}

// convertItems converts a list of items to FTS5, tracking scope
func convertItems(items []*Item, initialScope string) string {
	if len(items) == 0 {
		return ""
	}

	var parts []string
	scope := initialScope // "", "title", or "body"

	for _, item := range items {
		if item.Filter != nil {
			key := strings.ToLower(item.Filter.Key)

			if item.Filter.Value == nil || *item.Filter.Value == "" {
				continue
			}

			val := *item.Filter.Value

			switch key {
			case "project":
				continue
			case "tag":
				continue
			case "in":
				scopeVal := strings.ToLower(val)
				if scopeVal == "title" || scopeVal == "body" {
					scope = scopeVal
				}
			case "title":
				sanitizedVal := sanitizeTerm(val)
				if sanitizedVal == "" {
					continue
				}
				quoted := quoteIfNeeded(sanitizedVal)
				parts = append(parts, ftsCol("title", quoted))
			case "body":
				sanitizedVal := sanitizeTerm(val)
				if sanitizedVal == "" {
					continue
				}
				quoted := quoteIfNeeded(sanitizedVal)
				parts = append(parts, ftsCol("body", quoted))
			default:
				sanitizedVal := sanitizeTerm(item.Filter.Key + ":" + val)
				if sanitizedVal == "" {
					continue
				}
				quoted := quoteIfNeeded(sanitizedVal)
				var clause string
				switch scope {
				case "title":
					clause = ftsCol("title", quoted)
				case "body":
					clause = ftsCol("body", quoted)
				default:
					clause = "(" + ftsCol("title", quoted) + " OR " + ftsCol("body", quoted) + ")"
				}
				parts = append(parts, clause)
			}
		} else if item.Term != nil {
			termVal := item.Term.Value()
			termVal = strings.ReplaceAll(termVal, "'", "")
			termVal = sanitizeTerm(termVal)
			if termVal == "" {
				continue
			}

			quoted := quoteIfNeeded(termVal)

			var clause string
			switch scope {
			case "title":
				clause = ftsCol("title", quoted)
			case "body":
				clause = ftsCol("body", quoted)
			default:
				clause = "(" + ftsCol("title", quoted) + " OR " + ftsCol("body", quoted) + ")"
			}

			if item.Term.Negated {
				clause = "NOT " + clause
			}

			parts = append(parts, clause)
		}
	}

	if len(parts) == 0 {
		return ""
	}

	// Join parts, handling NOT specially to avoid "AND NOT"
	var result strings.Builder
	for i, part := range parts {
		if i > 0 {
			if strings.HasPrefix(part, "NOT ") {
				result.WriteString(" ")
			} else {
				result.WriteString(" AND ")
			}
		}
		result.WriteString(part)
	}

	return result.String()
}

func needsParens(s string) bool {
	needs := strings.Contains(s, " AND ")
	logger.Debugf("checking if string needs parentheses string=%s needs=%t", s, needs)
	return needs
}

func ftsCol(col, val string) string {
	if !strings.HasPrefix(val, `"`) && strings.ContainsAny(val, "#@") {
		val = `"` + val + `"`
		logger.Debugf("quoted value for column %s value=%s", col, val)
	}
	result := col + ":" + val
	logger.Debugf("created fts column expression col=%s val=%s result=%s", col, val, result)
	return result
}

func quoteIfNeeded(term string) string {
	needs := strings.ContainsAny(term, " ()\"")
	if needs {
		quoted := `"` + strings.ReplaceAll(term, `"`, `""`) + `"`
		logger.Debugf("quoted term term=%s quoted=%s", term, quoted)
		return quoted
	}
	logger.Debugf("term does not need quoting term=%s", term)
	return term
}

// sanitizeTerm removes or escapes characters that are invalid in FTS5 queries.
// FTS5 only allows * at the end of a term for prefix matching.
// Characters like . ? + are not valid FTS5 operators and will cause syntax errors.
func sanitizeTerm(term string) string {
	if term == "" {
		return ""
	}

	hasSuffix := strings.HasSuffix(term, "*")
	if hasSuffix {
		term = strings.TrimSuffix(term, "*")
	}

	// Remove characters that are invalid in FTS5 terms
	// Valid: alphanumeric, underscore, and characters specified in tokenchars (.-_/@#)
	// Invalid as operators: . * ? + when used incorrectly
	var result strings.Builder
	for _, r := range term {
		switch r {
		case '.', '?', '+', '\\', '[', ']', '^', '$', '|', '{', '}':
			// Skip regex-like characters that cause FTS5 syntax errors
			continue
		case '*':
			// Only allow * at the end (handled separately)
			continue
		default:
			result.WriteRune(r)
		}
	}

	sanitized := result.String()
	if sanitized == "" {
		return ""
	}

	if hasSuffix {
		sanitized += "*"
	}

	if sanitized != term || (hasSuffix && !strings.HasSuffix(term, "*")) {
		logger.Debugf("sanitized term original=%s sanitized=%s", term, sanitized)
	}

	return sanitized
}

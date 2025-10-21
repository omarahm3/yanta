package search

import (
	"strings"
	"yanta/internal/logger"

	"github.com/alecthomas/participle/v2"
	"github.com/alecthomas/participle/v2/lexer"
)

type Query struct {
	Expression *OrExpression `parser:"@@?"`
}

type OrExpression struct {
	And []*AndExpression `parser:"@@ ( 'OR' @@ )*"`
}

type AndExpression struct {
	Items []*Item `parser:"@@ ( 'AND'? @@ )*"`
}

type Item struct {
	Filter *Filter `parser:"  @@"`
	Term   *Term   `parser:"| @@"`
}

type Filter struct {
	Key   string  `parser:"@Ident ':'"`
	Value *string `parser:"@(String | Ident | 'OR' | 'AND')?"`
}

type Term struct {
	Negated bool    `parser:"@'-'?"`
	Phrase  *string `parser:"( @String"`
	Word    *string `parser:"| @Ident )"`
}

func (t *Term) Value() string {
	logger.Debugf("getting term value negated=%t phrase=%v word=%v", t.Negated, t.Phrase, t.Word)

	if t.Phrase != nil {
		logger.Debugf("returning phrase value=%s", *t.Phrase)
		return *t.Phrase
	}
	if t.Word != nil {
		logger.Debugf("returning word value=%s", *t.Word)
		return *t.Word
	}

	logger.Debug("no phrase or word found, returning empty string")
	return ""
}

var (
	searchLexer = lexer.MustSimple([]lexer.SimpleRule{
		{Name: "String", Pattern: `"(?:[^"\\]|\\.)*"`},
		{Name: "OR", Pattern: `\bOR\b`},
		{Name: "AND", Pattern: `\bAND\b`},
		{Name: "Ident", Pattern: `[^\s:\-"]+`},
		{Name: "Punct", Pattern: `[:\-]`},
		{Name: "whitespace", Pattern: `\s+`},
	})

	parser = participle.MustBuild[Query](
		participle.Lexer(searchLexer),
		participle.Unquote("String"),
	)
)

func Parse(input string) (*Query, error) {
	logger.Debugf("parsing search query input=%s", input)

	if input == "" {
		logger.Debug("empty input provided, returning nil query")
		return &Query{}, nil
	}

	query, err := parser.ParseString("", input)
	if err != nil {
		logger.Errorf("failed to parse search query input=%s error=%v", input, err)
		return nil, err
	}

	if query.Expression != nil {
		logger.Debugf("query parsed successfully andCount=%d", len(query.Expression.And))
		for i, andExpr := range query.Expression.And {
			logger.Debugf("and expression %d has %d items", i+1, len(andExpr.Items))
			for j, item := range andExpr.Items {
				if item.Filter != nil {
					filterValue := ""
					if item.Filter.Value != nil {
						filterValue = *item.Filter.Value
					}
					logger.Debugf("item %d.%d is filter key=%s value=%s", i+1, j+1, item.Filter.Key, filterValue)
				} else if item.Term != nil {
					logger.Debugf("item %d.%d is term value=%s negated=%t", i+1, j+1, item.Term.Value(), item.Term.Negated)
				}
			}
		}
	} else {
		logger.Debug("query parsed but expression is nil")
	}

	logger.Infof("search query parsed successfully input=%s", input)
	return query, nil
}

// ExtractFilters extracts project and tag filters from the query
func (q *Query) ExtractFilters() (projectAliases []string, tags []string) {
	if q == nil || q.Expression == nil {
		return nil, nil
	}

	for _, andExpr := range q.Expression.And {
		for _, item := range andExpr.Items {
			if item.Filter != nil {
				key := strings.ToLower(item.Filter.Key)

				if item.Filter.Value == nil || *item.Filter.Value == "" {
					continue
				}

				val := *item.Filter.Value

				switch key {
				case "project":
					projectAliases = append(projectAliases, val)
				case "tag":
					tag := strings.TrimPrefix(val, "#")
					tag = strings.ToLower(tag)
					tags = append(tags, tag)
				}
			}
		}
	}

	return projectAliases, tags
}

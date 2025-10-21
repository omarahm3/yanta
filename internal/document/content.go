package document

import (
	"strings"
)

type ExtractedContent struct {
	Title    string
	Headings []string
	Body     []string
	Code     []string

	Links  []Link
	Assets []Asset

	HasCode   bool
	HasImages bool
	HasLinks  bool
}

type Link struct {
	URL  string
	Host string
}

type Asset struct {
	Path    string
	Caption string
}

func (ec *ExtractedContent) FTSTitle() string {
	return ec.Title
}

func (ec *ExtractedContent) FTSHeadings() string {
	return strings.Join(ec.Headings, " ")
}

func (ec *ExtractedContent) FTSBody() string {
	return strings.Join(ec.Body, " ")
}

func (ec *ExtractedContent) FTSCode() string {
	return strings.Join(ec.Code, "\n\n")
}

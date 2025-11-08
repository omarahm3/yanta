package document

import "fmt"

func ValidateBlockNoteStructure(blocks []BlockNoteBlock) error {
	for i, block := range blocks {
		if err := validateBlock(block, 0); err != nil {
			return fmt.Errorf("block %d invalid: %w", i, err)
		}
		if err := validateContent(block.Content); err != nil {
			return fmt.Errorf("block %d content invalid: %w", i, err)
		}
	}
	return nil
}

func validateContent(content []BlockNoteContent) error {
	for i, item := range content {
		if item.Type == "" {
			return fmt.Errorf("content[%d]: type is required", i)
		}

		if item.Type == "link" {
			if item.Href == "" {
				return fmt.Errorf("content[%d]: link must have href", i)
			}
			if len(item.Content) == 0 {
				return fmt.Errorf("content[%d]: link must have nested content array", i)
			}
			if err := validateContent(item.Content); err != nil {
				return fmt.Errorf("content[%d] nested: %w", i, err)
			}
		}

		if item.Type == "text" {
			if item.Styles == nil {
				return fmt.Errorf("content[%d]: text must have styles map (can be empty)", i)
			}
		}
	}
	return nil
}

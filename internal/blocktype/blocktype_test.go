package blocktype

import "testing"

func TestKnown(t *testing.T) {
	known := []string{
		Heading, Paragraph, CodeBlock, BulletListItem, NumberedListItem,
		CheckListItem, Image, File, Quote, Table,
	}
	for _, typ := range known {
		if !Known(typ) {
			t.Errorf("Known(%q) = false, want true", typ)
		}
	}

	for _, typ := range []string{"", "unknownBlock", "video", "audio", "pageBreak"} {
		if Known(typ) {
			t.Errorf("Known(%q) = true, want false", typ)
		}
	}
}

func TestBlockTypeConstantsUnique(t *testing.T) {
	all := map[string]bool{}
	for _, typ := range []string{
		Heading, Paragraph, CodeBlock, BulletListItem, NumberedListItem,
		CheckListItem, Image, File, Quote, Table,
	} {
		if typ == "" {
			t.Fatal("block type constant is empty")
		}
		if all[typ] {
			t.Fatalf("duplicate block type constant %q", typ)
		}
		all[typ] = true
	}
}

# Manual Testing: PDF Export Feature

## Test Status: Ready for Manual Verification

All automated tests have passed:
- ✅ Backend unit tests (94.9% coverage)
- ✅ Backend integration tests
- ✅ Frontend tests
- ✅ Application builds successfully

## How to Run Manual Tests

### 1. Start the Application
```bash
wails3 dev
```

### 2. Create a Test Document

Create a new document in Yanta with the following content to test all block types:

```markdown
# Heading Level 1 - PDF Export Test

This is a comprehensive test document to verify PDF export functionality.

## Code Blocks

### Go Example
```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, PDF!")
    numbers := []int{1, 2, 3, 4, 5}
    for _, num := range numbers {
        fmt.Printf("Number: %d\n", num)
    }
}
```

### JavaScript Example
```javascript
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log(`Fibonacci(10) = ${result}`);
```

### Python Example
```python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

print(quicksort([3, 6, 8, 10, 1, 2, 1]))
```

## Lists

### Bullet List
- First bullet item
- Second bullet item
- Third bullet item with more text to test wrapping behavior in PDF export

### Numbered List
1. First numbered item
2. Second numbered item
3. Third numbered item with longer text to verify proper rendering

### Checklist
- [ ] Unchecked task item
- [x] Checked task item
- [ ] Another unchecked item

## Block Quote

> This is a block quote to test quote rendering in PDF.
> It should have visual styling to distinguish it from regular text.
> Multiple lines should be properly formatted and indented.

## Table

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Data A   | Data B   | Data C   |
| Row 3    | More     | Data     |

## Image

Upload a test image using the asset upload feature and insert it here.
Add a caption: "Test image for PDF export verification"
```

### 3. Export to PDF

**Method 1: Keyboard Shortcut**
- Press `Ctrl+Shift+E`

**Method 2: Command Palette**
- Type `export-pdf` in the command palette

### 4. Verify Export

In the file save dialog:
- ✅ Default filename should be based on document title
- ✅ Filter should be "PDF Files (*.pdf)"
- Choose a save location and click Save
- ✅ Success notification should appear

### 5. Inspect the PDF

Open the generated PDF and verify:

**Headings:**
- [ ] H1 is larger than H2
- [ ] H2 is larger than H3
- [ ] Clear visual hierarchy

**Paragraphs:**
- [ ] Text wraps properly
- [ ] Readable font size
- [ ] Appropriate line spacing

**Code Blocks:**
- [ ] Monospace font used
- [ ] Proper indentation preserved
- [ ] Syntax highlighting visible (different colors for keywords, strings, comments)
- [ ] Language label shown (if implemented)

**Lists:**
- [ ] Bullet points visible
- [ ] Numbers sequential
- [ ] Checkbox symbols present
- [ ] Proper indentation

**Quote:**
- [ ] Visually distinct (border, background, or indent)
- [ ] Readable

**Table:**
- [ ] Grid lines visible
- [ ] Alternating row colors (if implemented)
- [ ] Content aligned properly

**Images (if included):**
- [ ] Embedded correctly
- [ ] Not distorted
- [ ] Reasonable resolution
- [ ] Caption displayed

**Overall:**
- [ ] Professional appearance
- [ ] No overlapping content
- [ ] Consistent formatting
- [ ] Page breaks handled intelligently

## Edge Case Tests

### Test 1: Empty Document
1. Create an empty document (no content blocks)
2. Export to PDF
3. Verify: No crash, either creates blank PDF or shows appropriate message

### Test 2: Document Without Images
1. Create document with only text blocks
2. Export to PDF
3. Verify: Export succeeds

### Test 3: Very Long Document
1. Create document with 20+ headings and paragraphs
2. Export to PDF
3. Verify:
   - Export completes without timeout
   - Multi-page PDF created
   - Content flows properly across pages

### Test 4: Cancel Dialog
1. Press Ctrl+Shift+E
2. Click "Cancel" in the save dialog
3. Verify: No error message, operation cancelled silently

### Test 5: Special Characters
1. Create document with special chars: ™, ©, ®, €, £
2. Export to PDF
3. Verify: Characters render correctly or are replaced gracefully

## Success Criteria

- ✅ All tests in sections 3-6 pass
- ✅ No application crashes
- ✅ No console errors
- ✅ PDFs created successfully
- ✅ All block types render correctly
- ✅ Professional output quality
- ✅ Command accessible via Ctrl+Shift+E
- ✅ Command palette integration works

## Reporting Results

After completing manual tests, update:
- `./.auto-claude/specs/006-export-to-pdf/implementation_plan.json`
  - Set `subtask-4-1` status to "completed"
  - Add notes with test results

If issues found:
1. Document specific failure
2. Steps to reproduce
3. Expected vs actual behavior
4. Screenshots/PDF samples
5. Console errors

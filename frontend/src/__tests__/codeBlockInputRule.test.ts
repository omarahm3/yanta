import { describe, expect, it } from "vitest";

/**
 * Pattern to match code block trigger: ``` optionally followed by a language identifier.
 * This is the same pattern used in CodeBlockInputRuleExtension.
 */
const CODE_BLOCK_PATTERN = /^```(\w*)$/;

describe("codeBlockInputRule", () => {
	describe("CODE_BLOCK_PATTERN matching", () => {
		it("matches ``` at line start", () => {
			const match = "```".match(CODE_BLOCK_PATTERN);
			expect(match).not.toBeNull();
			expect(match?.[1]).toBe("");
		});

		it("matches ```javascript with language", () => {
			const match = "```javascript".match(CODE_BLOCK_PATTERN);
			expect(match).not.toBeNull();
			expect(match?.[1]).toBe("javascript");
		});

		it("matches ```python with language", () => {
			const match = "```python".match(CODE_BLOCK_PATTERN);
			expect(match).not.toBeNull();
			expect(match?.[1]).toBe("python");
		});

		it("matches ```ts with short language identifier", () => {
			const match = "```ts".match(CODE_BLOCK_PATTERN);
			expect(match).not.toBeNull();
			expect(match?.[1]).toBe("ts");
		});

		it("matches ```typescript with long language identifier", () => {
			const match = "```typescript".match(CODE_BLOCK_PATTERN);
			expect(match).not.toBeNull();
			expect(match?.[1]).toBe("typescript");
		});

		it("matches ```go with short language identifier", () => {
			const match = "```go".match(CODE_BLOCK_PATTERN);
			expect(match).not.toBeNull();
			expect(match?.[1]).toBe("go");
		});

		it("does not match `` (2 backticks)", () => {
			const match = "``".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match ```` (4 backticks)", () => {
			const match = "````".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match ````` (5 backticks)", () => {
			const match = "`````".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match text``` (mid-line backticks)", () => {
			const match = "text```".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match prefix``` (any text before backticks)", () => {
			const match = "prefix```".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match ``` followed by space and language", () => {
			const match = "``` javascript".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match ``` with trailing space", () => {
			const match = "``` ".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match ```language with trailing space", () => {
			const match = "```javascript ".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match ``` with leading space", () => {
			const match = " ```".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match ``` with leading whitespace", () => {
			const match = "  ```".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match ``` with text after language", () => {
			const match = "```javascript code".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match single backtick", () => {
			const match = "`".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match empty string", () => {
			const match = "".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});
	});

	describe("language extraction", () => {
		it("extracts empty string when no language specified", () => {
			const match = "```".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("");
		});

		it("extracts javascript from ```javascript", () => {
			const match = "```javascript".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("javascript");
		});

		it("extracts python from ```python", () => {
			const match = "```python".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("python");
		});

		it("extracts ts from ```ts", () => {
			const match = "```ts".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("ts");
		});

		it("extracts rust from ```rust", () => {
			const match = "```rust".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("rust");
		});

		it("extracts cpp from ```cpp", () => {
			const match = "```cpp".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("cpp");
		});

		it("extracts sql from ```sql", () => {
			const match = "```sql".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("sql");
		});

		it("extracts json from ```json", () => {
			const match = "```json".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("json");
		});

		it("extracts yaml from ```yaml", () => {
			const match = "```yaml".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("yaml");
		});

		it("extracts bash from ```bash", () => {
			const match = "```bash".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("bash");
		});

		it("extracts language with numbers like js2 from ```js2", () => {
			const match = "```js2".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("js2");
		});

		it("extracts language with underscores like c_sharp from ```c_sharp", () => {
			const match = "```c_sharp".match(CODE_BLOCK_PATTERN);
			expect(match?.[1]).toBe("c_sharp");
		});
	});

	describe("edge cases and boundary conditions", () => {
		it("handles very long language identifiers", () => {
			const longLang = "a".repeat(100);
			const match = `\`\`\`${longLang}`.match(CODE_BLOCK_PATTERN);
			expect(match).not.toBeNull();
			expect(match?.[1]).toBe(longLang);
		});

		it("does not match language with special characters (dash)", () => {
			const match = "```c-sharp".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match language with special characters (plus)", () => {
			const match = "```c++".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match language with special characters (hash)", () => {
			const match = "```c#".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match language with dot", () => {
			const match = "```v1.0".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("matches language starting with number", () => {
			const match = "```1c".match(CODE_BLOCK_PATTERN);
			expect(match).not.toBeNull();
			expect(match?.[1]).toBe("1c");
		});

		it("does not match code block with newline in middle", () => {
			const match = "```\njavascript".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("does not match closing code block with triple backticks after content", () => {
			const match = "code```".match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("only matches at start of string (^ anchor)", () => {
			const multiline = "some text\n```javascript";
			const match = multiline.match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});

		it("only matches at end of string ($ anchor)", () => {
			const withTrailing = "```javascript\nmore";
			const match = withTrailing.match(CODE_BLOCK_PATTERN);
			expect(match).toBeNull();
		});
	});
});

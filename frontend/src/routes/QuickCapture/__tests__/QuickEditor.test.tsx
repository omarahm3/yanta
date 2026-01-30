import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickEditor } from "../QuickEditor";

describe("QuickEditor", () => {
	it("renders textarea with placeholder", () => {
		render(<QuickEditor value="" onChange={vi.fn()} />);

		const textarea = screen.getByPlaceholderText("What's on your mind?");
		expect(textarea).toBeInTheDocument();
	});

	it("calls onChange when typing", () => {
		const onChange = vi.fn();
		render(<QuickEditor value="" onChange={onChange} />);

		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Hello" } });

		expect(onChange).toHaveBeenCalledWith("Hello");
	});

	it("highlights #tags in green", () => {
		render(<QuickEditor value="Fix bug #urgent" onChange={vi.fn()} />);

		// The highlight layer should contain a span with the tag
		const highlightLayer = document.querySelector("[data-testid='highlight-layer']");
		expect(highlightLayer).toBeInTheDocument();
		expect(highlightLayer?.innerHTML).toContain("#urgent");
		expect(highlightLayer?.innerHTML).toContain("text-[#98C379]");
	});

	it("highlights @project in blue", () => {
		render(<QuickEditor value="Note @work" onChange={vi.fn()} />);

		const highlightLayer = document.querySelector("[data-testid='highlight-layer']");
		expect(highlightLayer).toBeInTheDocument();
		expect(highlightLayer?.innerHTML).toContain("@work");
		expect(highlightLayer?.innerHTML).toContain("text-[#61AFEF]");
	});

	it("respects maxLength", () => {
		render(<QuickEditor value="" onChange={vi.fn()} maxLength={100} />);

		const textarea = screen.getByRole("textbox");
		expect(textarea).toHaveAttribute("maxLength", "100");
	});

	it("auto-focuses on mount when autoFocus is true", () => {
		render(<QuickEditor value="" onChange={vi.fn()} autoFocus />);

		const textarea = screen.getByRole("textbox");
		expect(document.activeElement).toBe(textarea);
	});

	it("displays current value", () => {
		render(<QuickEditor value="Existing content" onChange={vi.fn()} />);

		const textarea = screen.getByRole("textbox");
		expect(textarea).toHaveValue("Existing content");
	});

	it("calls onKeyDown when key is pressed", () => {
		const onKeyDown = vi.fn();
		render(<QuickEditor value="" onChange={vi.fn()} onKeyDown={onKeyDown} />);

		const textarea = screen.getByRole("textbox");
		fireEvent.keyDown(textarea, { key: "Enter" });

		expect(onKeyDown).toHaveBeenCalled();
	});

	it("shows character count when near limit", () => {
		const longText = "a".repeat(8500);
		render(<QuickEditor value={longText} onChange={vi.fn()} maxLength={10000} />);

		expect(screen.getByText(/8500/)).toBeInTheDocument();
	});

	it("shows character count in red when very close to limit", () => {
		const longText = "a".repeat(9600);
		render(<QuickEditor value={longText} onChange={vi.fn()} maxLength={10000} />);

		const counter = screen.getByTestId("char-counter");
		expect(counter).toHaveClass("text-[#E06C75]");
	});
});

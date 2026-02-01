import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TagChips } from "../TagChips";

describe("TagChips", () => {
	it("renders tags as chips", () => {
		render(<TagChips tags={["urgent", "backend"]} onRemove={vi.fn()} />);

		expect(screen.getByText("urgent")).toBeInTheDocument();
		expect(screen.getByText("backend")).toBeInTheDocument();
	});

	it("renders empty state when no tags", () => {
		const { container } = render(<TagChips tags={[]} onRemove={vi.fn()} />);
		expect(container.querySelector(".tag-chip")).toBeNull();
	});

	it("removes tag on X click", () => {
		const onRemove = vi.fn();
		render(<TagChips tags={["urgent", "backend"]} onRemove={onRemove} />);

		const removeButtons = screen.getAllByRole("button", { name: /remove/i });
		fireEvent.click(removeButtons[0]);

		expect(onRemove).toHaveBeenCalledWith("urgent");
	});

	it("shows hash prefix on tags", () => {
		render(<TagChips tags={["todo"]} onRemove={vi.fn()} />);
		expect(screen.getByText("#")).toBeInTheDocument();
	});

	it("renders multiple tags in order", () => {
		render(<TagChips tags={["first", "second", "third"]} onRemove={vi.fn()} />);

		const chips = screen.getAllByTestId("tag-chip");
		expect(chips).toHaveLength(3);
	});

	it("applies custom className", () => {
		const { container } = render(
			<TagChips tags={["test"]} onRemove={vi.fn()} className="custom-class" />,
		);
		expect(container.firstChild).toHaveClass("custom-class");
	});
});

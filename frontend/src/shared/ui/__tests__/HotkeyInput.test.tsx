import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HotkeyInput } from "../HotkeyInput";

describe("HotkeyInput", () => {
	it("renders with placeholder when no value", () => {
		render(<HotkeyInput value="" onChange={() => {}} />);
		expect(screen.getByText("Click and press keys...")).toBeInTheDocument();
	});

	it("renders the committed value", () => {
		render(<HotkeyInput value="Ctrl+S" onChange={() => {}} />);
		expect(screen.getByText("Ctrl+S")).toBeInTheDocument();
	});

	it("commits a key combo immediately on capture", () => {
		const onChange = vi.fn();
		const { container } = render(<HotkeyInput value="" onChange={onChange} />);

		const el = container.firstElementChild!;
		fireEvent.focus(el);
		fireEvent.keyDown(el, { key: "s", ctrlKey: true });

		expect(onChange).toHaveBeenCalledWith("Ctrl+S");
	});

	it("ignores modifier-only key presses", () => {
		const onChange = vi.fn();
		const { container } = render(<HotkeyInput value="" onChange={onChange} />);

		const el = container.firstElementChild!;
		fireEvent.focus(el);
		fireEvent.keyDown(el, { key: "Control", ctrlKey: true });

		expect(onChange).not.toHaveBeenCalled();
	});

	it("Esc cancels capture without committing", () => {
		const onChange = vi.fn();
		const { container } = render(<HotkeyInput value="" onChange={onChange} />);

		const el = container.firstElementChild!;
		fireEvent.focus(el);
		fireEvent.keyDown(el, { key: "Escape" });

		expect(onChange).not.toHaveBeenCalled();
	});

	it("does not call onChange on blur when nothing was captured", () => {
		const onChange = vi.fn();
		const { container } = render(<HotkeyInput value="" onChange={onChange} />);

		const el = container.firstElementChild!;
		fireEvent.focus(el);
		fireEvent.blur(el);

		expect(onChange).not.toHaveBeenCalled();
	});

	it("respects disabled prop", () => {
		const onChange = vi.fn();
		const { container } = render(<HotkeyInput value="" onChange={onChange} disabled />);

		const el = container.firstElementChild!;
		fireEvent.focus(el);
		fireEvent.keyDown(el, { key: "s", ctrlKey: true });

		expect(onChange).not.toHaveBeenCalled();
	});
});

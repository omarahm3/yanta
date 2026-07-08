import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HotkeyConfig } from "../../../shared/types/hotkeys";
import { HotkeyProvider, useHotkeys } from "../../index";

function Harness({ configs }: { configs: HotkeyConfig[] }) {
	useHotkeys(configs);
	return (
		<>
			<input data-testid="input" />
			<button data-testid="button" type="button">
				Btn
			</button>
			<div data-testid="plain" />
		</>
	);
}

const renderWith = (configs: HotkeyConfig[]) =>
	render(
		<HotkeyProvider>
			<Harness configs={configs} />
		</HotkeyProvider>,
	);

describe("hotkey dispatcher — target eligibility & preventDefault ordering", () => {
	it("does not eat characters typed into an input", () => {
		const handler = vi.fn();
		const { getByTestId } = renderWith([{ key: "j", handler }]);
		const input = getByTestId("input");
		input.focus();

		// fireEvent returns false when the event's default was prevented.
		const notPrevented = fireEvent.keyDown(input, { key: "j" });

		expect(handler).not.toHaveBeenCalled();
		expect(notPrevented).toBe(true); // character reaches the input, not swallowed
	});

	it("fires and prevents default on a non-interactive target when consumed", () => {
		const handler = vi.fn();
		const { getByTestId } = renderWith([{ key: "j", handler }]);
		const plain = getByTestId("plain");

		const notPrevented = fireEvent.keyDown(plain, { key: "j" });

		expect(handler).toHaveBeenCalledTimes(1);
		expect(notPrevented).toBe(false); // consumed → default prevented
	});

	it("does not hijack plain Enter/Space/j from a focused button", () => {
		const handler = vi.fn();
		const { getByTestId } = renderWith([
			{ key: "Enter", handler },
			{ key: "Space", handler },
			{ key: "j", handler },
		]);
		const button = getByTestId("button");
		button.focus();

		const enterOk = fireEvent.keyDown(button, { key: "Enter" });
		const spaceOk = fireEvent.keyDown(button, { key: " " });
		const jOk = fireEvent.keyDown(button, { key: "j" });

		expect(handler).not.toHaveBeenCalled();
		expect(enterOk).toBe(true); // native button activation preserved
		expect(spaceOk).toBe(true);
		expect(jOk).toBe(true);
	});

	it("still routes Escape to a focused button (no keyboard trap)", () => {
		const handler = vi.fn();
		const { getByTestId } = renderWith([{ key: "Escape", handler }]);
		const button = getByTestId("button");
		button.focus();

		fireEvent.keyDown(button, { key: "Escape" });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("still routes modifier combos to a focused button", () => {
		const handler = vi.fn();
		const { getByTestId } = renderWith([{ key: "ctrl+k", handler }]);
		const button = getByTestId("button");
		button.focus();

		const notPrevented = fireEvent.keyDown(button, { key: "k", ctrlKey: true });

		expect(handler).toHaveBeenCalledTimes(1);
		expect(notPrevented).toBe(false);
	});

	it("does not prevent default when the only handler declines (returns false)", () => {
		const handler = vi.fn(() => false);
		const { getByTestId } = renderWith([{ key: "j", handler }]);
		const plain = getByTestId("plain");

		const notPrevented = fireEvent.keyDown(plain, { key: "j" });

		expect(handler).toHaveBeenCalledTimes(1);
		expect(notPrevented).toBe(true); // declined → default not prevented
	});

	it("runs a handler in an input when allowInInput is set", () => {
		const handler = vi.fn();
		const { getByTestId } = renderWith([{ key: "j", handler, allowInInput: true }]);
		const input = getByTestId("input");
		input.focus();

		fireEvent.keyDown(input, { key: "j" });

		expect(handler).toHaveBeenCalledTimes(1);
	});
});

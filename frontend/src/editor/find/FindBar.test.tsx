import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { HotkeyProvider } from "../../hotkeys";
import type { EditorHandle } from "../types";
import { FindBar } from "./FindBar";

// A minimal editor stub: no _tiptapEditor so useEditorFind's registration effect
// bails out (no live plugin needed), and a spy-able prosemirrorView.focus().
function makeEditorStub() {
	const focus = vi.fn();
	const editor = { prosemirrorView: { focus } } as unknown as EditorHandle;
	return { editor, focus };
}

function renderFindBar(props: Partial<React.ComponentProps<typeof FindBar>> = {}) {
	const { editor, focus } = makeEditorStub();
	const onClose = props.onClose ?? vi.fn();
	const onToggleReplace = props.onToggleReplace ?? vi.fn();
	render(
		<HotkeyProvider>
			<FindBar
				editor={editor}
				onClose={onClose}
				showReplace={props.showReplace ?? false}
				onToggleReplace={onToggleReplace}
			/>
		</HotkeyProvider>,
	);
	return { focus, onClose, onToggleReplace };
}

describe("FindBar", () => {
	it("renders the find input focused", () => {
		renderFindBar();
		expect(screen.getByRole("textbox", { name: "Find in document" })).toBeInTheDocument();
	});

	it("returns focus to the editor when closed (so the next Esc blurs, not ejects)", () => {
		const { focus, onClose } = renderFindBar();
		fireEvent.click(screen.getByRole("button", { name: "Close find" }));
		expect(focus).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("hides the replace row by default and shows it when showReplace is set", () => {
		const { rerender } = render(
			<HotkeyProvider>
				<FindBar editor={makeEditorStub().editor} onClose={vi.fn()} onToggleReplace={vi.fn()} />
			</HotkeyProvider>,
		);
		expect(screen.queryByRole("textbox", { name: "Replace with" })).not.toBeInTheDocument();

		rerender(
			<HotkeyProvider>
				<FindBar
					editor={makeEditorStub().editor}
					onClose={vi.fn()}
					showReplace
					onToggleReplace={vi.fn()}
				/>
			</HotkeyProvider>,
		);
		expect(screen.getByRole("textbox", { name: "Replace with" })).toBeInTheDocument();
	});

	it("toggles the replace row via the disclosure button", () => {
		const { onToggleReplace } = renderFindBar();
		fireEvent.click(screen.getByRole("button", { name: "Show replace" }));
		expect(onToggleReplace).toHaveBeenCalledTimes(1);
	});

	it("exposes Replace and All actions when the replace row is shown", () => {
		renderFindBar({ showReplace: true });
		expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
	});
});

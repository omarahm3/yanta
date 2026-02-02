import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QuickCreateInput } from "../QuickCreateInput";

describe("QuickCreateInput", () => {
	const defaultProps = {
		projectAlias: "myproject",
		onCreateDocument: vi.fn(),
		onCreateJournalEntry: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Rendering", () => {
		it("renders the input element", () => {
			render(<QuickCreateInput {...defaultProps} />);
			expect(screen.getByRole("textbox")).toBeInTheDocument();
		});

		it("renders the project alias prefix with @ symbol", () => {
			render(<QuickCreateInput {...defaultProps} />);
			expect(screen.getByText("@myproject >")).toBeInTheDocument();
		});

		it("renders the placeholder text", () => {
			render(<QuickCreateInput {...defaultProps} />);
			expect(screen.getByPlaceholderText("Type to create...")).toBeInTheDocument();
		});

		it("renders hint badges for Enter and Shift+Enter", () => {
			const { container } = render(<QuickCreateInput {...defaultProps} />);
			const kbdElements = container.querySelectorAll("kbd");
			expect(kbdElements.length).toBe(2);
			expect(screen.getByText("Enter")).toBeInTheDocument();
			expect(screen.getByText("⇧Enter")).toBeInTheDocument();
			expect(screen.getByText("doc")).toBeInTheDocument();
			expect(screen.getByText("journal")).toBeInTheDocument();
		});

		it("has aria-label for accessibility", () => {
			render(<QuickCreateInput {...defaultProps} />);
			expect(screen.getByLabelText("Quick create input")).toBeInTheDocument();
		});
	});

	describe("Styling", () => {
		it("has border at top", () => {
			const { container } = render(<QuickCreateInput {...defaultProps} />);
			const wrapper = container.firstChild as HTMLElement;
			expect(wrapper).toHaveClass("border-t", "border-border");
		});

		it("has surface background", () => {
			const { container } = render(<QuickCreateInput {...defaultProps} />);
			const wrapper = container.firstChild as HTMLElement;
			expect(wrapper).toHaveClass("bg-surface");
		});

		it("uses monospace font for the project prefix", () => {
			const { container } = render(<QuickCreateInput {...defaultProps} />);
			const prefix = container.querySelector(".font-mono.font-semibold");
			expect(prefix).toBeInTheDocument();
			expect(prefix).toHaveTextContent("@myproject >");
		});

		it("uses monospace font for the input", () => {
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");
			expect(input).toHaveClass("font-mono");
		});

		it("applies custom className", () => {
			const { container } = render(<QuickCreateInput {...defaultProps} className="custom-class" />);
			const wrapper = container.firstChild as HTMLElement;
			expect(wrapper).toHaveClass("custom-class");
		});
	});

	describe("Controlled/Uncontrolled behavior", () => {
		it("works as uncontrolled component", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "test document");
			expect(input).toHaveValue("test document");
		});

		it("works as controlled component", async () => {
			const onChange = vi.fn();
			const { rerender } = render(
				<QuickCreateInput {...defaultProps} value="controlled" onChange={onChange} />,
			);
			const input = screen.getByRole("textbox");

			expect(input).toHaveValue("controlled");

			await userEvent.type(input, "x");
			expect(onChange).toHaveBeenCalledWith("controlledx");

			rerender(<QuickCreateInput {...defaultProps} value="updated" onChange={onChange} />);
			expect(input).toHaveValue("updated");
		});
	});

	describe("Enter key (Create Document)", () => {
		it("calls onCreateDocument with trimmed value on Enter", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "My New Document");
			await user.keyboard("{Enter}");

			expect(defaultProps.onCreateDocument).toHaveBeenCalledWith("My New Document");
			expect(defaultProps.onCreateDocument).toHaveBeenCalledTimes(1);
		});

		it("trims whitespace from input before calling onCreateDocument", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "  Whitespace Title  ");
			await user.keyboard("{Enter}");

			expect(defaultProps.onCreateDocument).toHaveBeenCalledWith("Whitespace Title");
		});

		it("clears input after successful document creation", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "New Doc");
			await user.keyboard("{Enter}");

			expect(input).toHaveValue("");
		});

		it("does not call onCreateDocument when input is empty", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			input.focus();
			await user.keyboard("{Enter}");

			expect(defaultProps.onCreateDocument).not.toHaveBeenCalled();
		});

		it("does not call onCreateDocument when input is only whitespace", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "   ");
			await user.keyboard("{Enter}");

			expect(defaultProps.onCreateDocument).not.toHaveBeenCalled();
		});

		it("does not call onCreateJournalEntry on Enter (without Shift)", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "Test");
			await user.keyboard("{Enter}");

			expect(defaultProps.onCreateJournalEntry).not.toHaveBeenCalled();
		});
	});

	describe("Shift+Enter key (Create Journal Entry)", () => {
		it("calls onCreateJournalEntry with trimmed value on Shift+Enter", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "My Journal Entry");
			await user.keyboard("{Shift>}{Enter}{/Shift}");

			expect(defaultProps.onCreateJournalEntry).toHaveBeenCalledWith("My Journal Entry");
			expect(defaultProps.onCreateJournalEntry).toHaveBeenCalledTimes(1);
		});

		it("trims whitespace from input before calling onCreateJournalEntry", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "  Whitespace Entry  ");
			await user.keyboard("{Shift>}{Enter}{/Shift}");

			expect(defaultProps.onCreateJournalEntry).toHaveBeenCalledWith("Whitespace Entry");
		});

		it("clears input after successful journal entry creation", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "Journal");
			await user.keyboard("{Shift>}{Enter}{/Shift}");

			expect(input).toHaveValue("");
		});

		it("does not call onCreateJournalEntry when input is empty", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			input.focus();
			await user.keyboard("{Shift>}{Enter}{/Shift}");

			expect(defaultProps.onCreateJournalEntry).not.toHaveBeenCalled();
		});

		it("does not call onCreateJournalEntry when input is only whitespace", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "   ");
			await user.keyboard("{Shift>}{Enter}{/Shift}");

			expect(defaultProps.onCreateJournalEntry).not.toHaveBeenCalled();
		});

		it("does not call onCreateDocument on Shift+Enter", async () => {
			const user = userEvent.setup();
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			await user.type(input, "Test");
			await user.keyboard("{Shift>}{Enter}{/Shift}");

			expect(defaultProps.onCreateDocument).not.toHaveBeenCalled();
		});
	});

	describe("Disabled state", () => {
		it("disables the input when disabled prop is true", () => {
			render(<QuickCreateInput {...defaultProps} disabled />);
			expect(screen.getByRole("textbox")).toBeDisabled();
		});

		it("applies opacity styling when disabled", () => {
			const { container } = render(<QuickCreateInput {...defaultProps} disabled />);
			const wrapper = container.firstChild as HTMLElement;
			expect(wrapper).toHaveClass("opacity-50", "pointer-events-none");
		});

		it("does not call onCreateDocument when disabled", async () => {
			render(<QuickCreateInput {...defaultProps} disabled value="Test" />);
			const input = screen.getByRole("textbox");

			fireEvent.keyDown(input, { key: "Enter" });

			expect(defaultProps.onCreateDocument).not.toHaveBeenCalled();
		});

		it("does not call onCreateJournalEntry when disabled", async () => {
			render(<QuickCreateInput {...defaultProps} disabled value="Test" />);
			const input = screen.getByRole("textbox");

			fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

			expect(defaultProps.onCreateJournalEntry).not.toHaveBeenCalled();
		});
	});

	describe("Focus management (Ctrl+D)", () => {
		it("focuses the input when Ctrl+D is pressed", () => {
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			expect(document.activeElement).not.toBe(input);

			fireEvent.keyDown(window, { key: "d", ctrlKey: true });

			expect(document.activeElement).toBe(input);
		});

		it("prevents default browser behavior on Ctrl+D", () => {
			render(<QuickCreateInput {...defaultProps} />);

			const event = new KeyboardEvent("keydown", {
				key: "d",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});
			const preventDefaultSpy = vi.spyOn(event, "preventDefault");

			window.dispatchEvent(event);

			expect(preventDefaultSpy).toHaveBeenCalled();
		});

		it("does not focus on D without Ctrl modifier", () => {
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			fireEvent.keyDown(window, { key: "d" });

			expect(document.activeElement).not.toBe(input);
		});

		it("does not focus on Ctrl+other keys", () => {
			render(<QuickCreateInput {...defaultProps} />);
			const input = screen.getByRole("textbox");

			fireEvent.keyDown(window, { key: "a", ctrlKey: true });
			fireEvent.keyDown(window, { key: "s", ctrlKey: true });
			fireEvent.keyDown(window, { key: "k", ctrlKey: true });

			expect(document.activeElement).not.toBe(input);
		});

		it("cleans up event listener on unmount", () => {
			const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

			const { unmount } = render(<QuickCreateInput {...defaultProps} />);
			unmount();

			expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
		});
	});

	describe("Project alias variations", () => {
		it("renders different project aliases correctly", () => {
			const { rerender } = render(<QuickCreateInput {...defaultProps} projectAlias="work" />);
			expect(screen.getByText("@work >")).toBeInTheDocument();

			rerender(<QuickCreateInput {...defaultProps} projectAlias="personal" />);
			expect(screen.getByText("@personal >")).toBeInTheDocument();

			rerender(<QuickCreateInput {...defaultProps} projectAlias="project-2024" />);
			expect(screen.getByText("@project-2024 >")).toBeInTheDocument();
		});

		it("handles empty project alias", () => {
			render(<QuickCreateInput {...defaultProps} projectAlias="" />);
			expect(screen.getByText("@ >")).toBeInTheDocument();
		});
	});

	describe("Ref forwarding", () => {
		it("forwards ref to the input element", () => {
			const ref = vi.fn();
			render(<QuickCreateInput {...defaultProps} ref={ref} />);

			expect(ref).toHaveBeenCalled();
			expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
		});

		it("allows programmatic focus via ref", () => {
			const ref = { current: null as HTMLInputElement | null };
			render(<QuickCreateInput {...defaultProps} ref={ref} />);

			act(() => {
				ref.current?.focus();
			});

			expect(document.activeElement).toBe(ref.current);
		});
	});

	describe("HintBadge styling", () => {
		it("renders kbd elements with monospace font", () => {
			const { container } = render(<QuickCreateInput {...defaultProps} />);
			const kbdElements = container.querySelectorAll("kbd");
			for (const kbd of kbdElements) {
				expect(kbd).toHaveClass("font-mono");
			}
		});

		it("renders kbd elements with border styling", () => {
			const { container } = render(<QuickCreateInput {...defaultProps} />);
			const kbdElements = container.querySelectorAll("kbd");
			for (const kbd of kbdElements) {
				expect(kbd).toHaveClass("border", "border-border");
			}
		});

		it("renders kbd elements with padding and border radius", () => {
			const { container } = render(<QuickCreateInput {...defaultProps} />);
			const kbdElements = container.querySelectorAll("kbd");
			for (const kbd of kbdElements) {
				expect(kbd).toHaveClass("px-1.5", "py-0.5", "rounded");
			}
		});
	});
});

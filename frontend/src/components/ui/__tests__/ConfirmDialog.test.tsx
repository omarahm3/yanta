import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DialogProvider } from "../../../contexts/DialogContext";
import { ConfirmDialog } from "../ConfirmDialog";

describe("ConfirmDialog", () => {
	it("renders nothing when closed", () => {
		const { container } = render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={false}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
				/>
			</DialogProvider>,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders dialog when open", () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test Title"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
				/>
				,
			</DialogProvider>,
		);
		expect(screen.getByText("Test Title")).toBeInTheDocument();
		expect(screen.getByText("Test message")).toBeInTheDocument();
	});

	it("renders cancel and confirm buttons that are focusable", () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
				/>
				,
			</DialogProvider>,
		);

		const cancelButton = screen.getByText("Cancel");
		const confirmButton = screen.getByText("Confirm");

		expect(cancelButton).toBeInTheDocument();
		expect(confirmButton).toBeInTheDocument();
		expect(cancelButton.tagName).toBe("BUTTON");
		expect(confirmButton.tagName).toBe("BUTTON");
	});

	it("calls onConfirm when confirm button is clicked", () => {
		const onConfirm = vi.fn();
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={onConfirm}
					onCancel={() => {}}
				/>
				,
			</DialogProvider>,
		);

		fireEvent.click(screen.getByText("Confirm"));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("calls onCancel when cancel button is clicked", () => {
		const onCancel = vi.fn();
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={onCancel}
				/>
				,
			</DialogProvider>,
		);

		fireEvent.click(screen.getByText("Cancel"));
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("shows danger styling when danger prop is true", () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					danger={true}
				/>
				,
			</DialogProvider>,
		);

		const confirmButton = screen.getByText("Confirm");
		expect(confirmButton.className).toContain("bg-red");
	});

	it("renders input prompt when provided", () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					inputPrompt="Type DELETE to confirm"
					expectedInput="DELETE"
				/>
				,
			</DialogProvider>,
		);

		expect(screen.getByText("Type DELETE to confirm")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("DELETE")).toBeInTheDocument();
	});

	it("disables confirm button when expected input does not match", () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					inputPrompt="Type DELETE to confirm"
					expectedInput="DELETE"
				/>
				,
			</DialogProvider>,
		);

		const confirmButton = screen.getByText("Confirm");
		expect(confirmButton).toBeDisabled();
	});

	it("enables confirm button when expected input matches", () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					inputPrompt="Type DELETE to confirm"
					expectedInput="DELETE"
				/>
				,
			</DialogProvider>,
		);

		const input = screen.getByPlaceholderText("DELETE");
		fireEvent.change(input, { target: { value: "DELETE" } });

		const confirmButton = screen.getByText("Confirm");
		expect(confirmButton).not.toBeDisabled();
	});

	it("renders checkbox when showCheckbox is true", () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					showCheckbox={true}
					checkboxLabel="I understand"
				/>
				,
			</DialogProvider>,
		);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toBeInTheDocument();
		expect(screen.getAllByText("I understand").length).toBeGreaterThan(0);
	});

	it("disables confirm button when checkbox is not checked", () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					showCheckbox={true}
				/>
				,
			</DialogProvider>,
		);

		const confirmButton = screen.getByText("Confirm");
		expect(confirmButton).toBeDisabled();
	});

	it("enables confirm button when checkbox is checked", () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					showCheckbox={true}
				/>
				,
			</DialogProvider>,
		);

		const checkbox = screen.getByRole("checkbox");
		fireEvent.click(checkbox);

		const confirmButton = screen.getByText("Confirm");
		expect(confirmButton).not.toBeDisabled();
	});

	it("requires both input and checkbox when both are present", () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					inputPrompt="Type DELETE"
					expectedInput="DELETE"
					showCheckbox={true}
				/>
				,
			</DialogProvider>,
		);

		const confirmButton = screen.getByText("Confirm");
		expect(confirmButton).toBeDisabled();

		const input = screen.getByPlaceholderText("DELETE");
		fireEvent.change(input, { target: { value: "DELETE" } });
		expect(confirmButton).toBeDisabled();

		const checkbox = screen.getByRole("checkbox");
		fireEvent.click(checkbox);
		expect(confirmButton).not.toBeDisabled();
	});

	it("resets state when dialog reopens", () => {
		const { rerender } = render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					inputPrompt="Type text"
					expectedInput="text"
					showCheckbox={true}
				/>
				,
			</DialogProvider>,
		);

		const input = screen.getByPlaceholderText("text");
		const checkbox = screen.getByRole("checkbox");

		fireEvent.change(input, { target: { value: "text" } });
		fireEvent.click(checkbox);

		rerender(
			<DialogProvider>
				<ConfirmDialog
					isOpen={false}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					inputPrompt="Type text"
					expectedInput="text"
					showCheckbox={true}
				/>
				,
			</DialogProvider>,
		);

		rerender(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					inputPrompt="Type text"
					expectedInput="text"
					showCheckbox={true}
				/>
				,
			</DialogProvider>,
		);

		const confirmButton = screen.getByText("Confirm");
		expect(confirmButton).toBeDisabled();
	});

	it("buttons work when dialog is open", () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();

		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={onConfirm}
					onCancel={onCancel}
				/>
			</DialogProvider>,
		);

		const cancelButton = screen.getByText("Cancel");
		fireEvent.click(cancelButton);
		expect(onCancel).toHaveBeenCalledTimes(1);

		const confirmButton = screen.getByText("Confirm");
		fireEvent.click(confirmButton);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("checkbox works when dialog is open", async () => {
		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen={true}
					title="Test"
					message="Test message"
					onConfirm={() => {}}
					onCancel={() => {}}
					showCheckbox={true}
					checkboxLabel="I understand"
				/>
			</DialogProvider>,
		);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toHaveAttribute("aria-checked", "false");

		fireEvent.click(checkbox);
		expect(checkbox).toHaveAttribute("aria-checked", "true");
	});
});

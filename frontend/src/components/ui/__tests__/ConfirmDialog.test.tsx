import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmDialog } from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ConfirmDialog
        isOpen={false}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog when open", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test message")).toBeInTheDocument();
  });

  it("focuses cancel button by default", async () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    await waitFor(() => expect(cancelButton).toHaveFocus());
  });

  it("moves focus to confirm button on tab", async () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    const confirmButton = screen.getByText("Confirm");

    await waitFor(() => expect(cancelButton).toHaveFocus());
    fireEvent.keyDown(cancelButton, { key: "Tab" });

    await waitFor(() => expect(confirmButton).toHaveFocus());
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows danger styling when danger prop is true", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
        danger={true}
      />
    );

    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton.className).toContain("bg-red");
  });

  it("renders input prompt when provided", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
        inputPrompt="Type DELETE to confirm"
        expectedInput="DELETE"
      />
    );

    expect(screen.getByText("Type DELETE to confirm")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("DELETE")).toBeInTheDocument();
  });

  it("disables confirm button when expected input does not match", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
        inputPrompt="Type DELETE to confirm"
        expectedInput="DELETE"
      />
    );

    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).toBeDisabled();
  });

  it("enables confirm button when expected input matches", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
        inputPrompt="Type DELETE to confirm"
        expectedInput="DELETE"
      />
    );

    const input = screen.getByPlaceholderText("DELETE");
    fireEvent.change(input, { target: { value: "DELETE" } });

    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).not.toBeDisabled();
  });

  it("renders checkbox when showCheckbox is true", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
        showCheckbox={true}
        checkboxLabel="I understand"
      />
    );

    expect(screen.getByText("I understand")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
  });

  it("disables confirm button when checkbox is not checked", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
        showCheckbox={true}
      />
    );

    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).toBeDisabled();
  });

  it("enables confirm button when checkbox is checked", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
        showCheckbox={true}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).not.toBeDisabled();
  });

  it("requires both input and checkbox when both are present", () => {
    render(
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
    );

    const input = screen.getByPlaceholderText("text");
    const checkbox = screen.getByRole("checkbox");

    fireEvent.change(input, { target: { value: "text" } });
    fireEvent.click(checkbox);

    rerender(
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
    );

    rerender(
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
    );

    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).toBeDisabled();
  });
});

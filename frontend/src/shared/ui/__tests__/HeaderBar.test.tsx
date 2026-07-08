import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderBar } from "../HeaderBar";

describe("HeaderBar back/forward controls", () => {
	it("does not render nav buttons when no handlers are provided", () => {
		render(<HeaderBar currentPage="Documents" breadcrumb="Home" />);
		expect(screen.queryByRole("button", { name: "Go back" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Go forward" })).not.toBeInTheDocument();
	});

	it("renders back/forward buttons, disabled by default", () => {
		render(
			<HeaderBar currentPage="Documents" breadcrumb="Home" onBack={vi.fn()} onForward={vi.fn()} />,
		);
		expect(screen.getByRole("button", { name: "Go back" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Go forward" })).toBeDisabled();
	});

	it("enables and invokes back when canGoBack", () => {
		const onBack = vi.fn();
		render(<HeaderBar currentPage="Documents" breadcrumb="Home" onBack={onBack} canGoBack={true} />);
		const back = screen.getByRole("button", { name: "Go back" });
		expect(back).toBeEnabled();
		fireEvent.click(back);
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it("enables and invokes forward when canGoForward", () => {
		const onForward = vi.fn();
		render(
			<HeaderBar
				currentPage="Documents"
				breadcrumb="Home"
				onForward={onForward}
				canGoForward={true}
			/>,
		);
		const forward = screen.getByRole("button", { name: "Go forward" });
		expect(forward).toBeEnabled();
		fireEvent.click(forward);
		expect(onForward).toHaveBeenCalledTimes(1);
	});
});

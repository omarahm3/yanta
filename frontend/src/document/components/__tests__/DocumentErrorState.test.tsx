import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../app", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../app")>();
	return {
		...actual,
		Layout: ({
			children,
			sidebarSections,
			currentPage,
		}: {
			children: React.ReactNode;
			sidebarSections: unknown[];
			currentPage: string;
		}) => (
			<div data-testid="layout" data-current-page={currentPage}>
				<div data-testid="sidebar">{JSON.stringify(sidebarSections)}</div>
				{children}
			</div>
		),
	};
});

import { DocumentErrorState } from "../DocumentErrorState";

describe("DocumentErrorState (MRG-328)", () => {
	it("renders the real error message", () => {
		render(<DocumentErrorState sidebarSections={[]} error="document not found" onRetry={() => {}} />);

		// The heading (text-xl text-red) should show "Document Not Found"
		const heading = document.querySelector(".text-xl.text-red");
		expect(heading?.textContent).toContain("Document Not Found");
		// The raw error should also be displayed
		expect(screen.getByText("document not found")).toBeInTheDocument();
	});

	it("renders a Retry button that calls onRetry", async () => {
		const onRetry = vi.fn();
		const user = userEvent.setup();

		render(<DocumentErrorState sidebarSections={[]} error="some error" onRetry={onRetry} />);

		const retryButton = screen.getByRole("button", { name: /retry/i });
		expect(retryButton).toBeInTheDocument();

		await user.click(retryButton);
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("shows distinct copy for a corrupted file vs not-found", () => {
		const { rerender } = render(
			<DocumentErrorState sidebarSections={[]} error="document not found" onRetry={() => {}} />,
		);

		// Not-found: heading contains "Document Not Found"
		const heading = document.querySelector(".text-xl.text-red");
		expect(heading?.textContent).toContain("Document Not Found");
		expect(screen.getByText(/It may have been deleted or doesn't exist/)).toBeInTheDocument();

		rerender(
			<DocumentErrorState sidebarSections={[]} error="document file corrupted" onRetry={() => {}} />,
		);

		// Corrupted: heading changes to "Document Corrupted"
		const corruptedHeading = document.querySelector(".text-xl.text-red");
		expect(corruptedHeading?.textContent).toContain("Document Corrupted");
		expect(screen.getByText(/could not be parsed/i)).toBeInTheDocument();
	});

	it("renders within Layout chrome", () => {
		render(<DocumentErrorState sidebarSections={[]} error="some error" onRetry={() => {}} />);

		expect(screen.getByTestId("layout")).toBeInTheDocument();
		expect(screen.getByTestId("layout")).toHaveAttribute("data-current-page", "document");
	});
});

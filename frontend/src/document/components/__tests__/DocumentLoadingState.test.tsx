import { render, screen } from "@testing-library/react";
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

import { DocumentLoadingState } from "../DocumentLoadingState";

describe("DocumentLoadingState (MRG-327)", () => {
	it("renders Layout chrome with sidebar, not a bare fullscreen spinner", () => {
		const sidebarSections = [{ title: "Docs", items: [] }];
		render(<DocumentLoadingState sidebarSections={sidebarSections} />);

		expect(screen.getByTestId("layout")).toBeInTheDocument();
		expect(screen.getByTestId("sidebar")).toBeInTheDocument();
		expect(screen.getByTestId("layout")).toHaveAttribute("data-current-page", "document");
	});

	it("renders a skeleton with role=status and aria-busy", () => {
		render(<DocumentLoadingState sidebarSections={[]} />);

		const skeleton = screen.getByRole("status");
		expect(skeleton).toBeInTheDocument();
		expect(skeleton).toHaveAttribute("aria-busy", "true");
	});

	it("does not render a fullscreen overlay spinner", () => {
		render(<DocumentLoadingState sidebarSections={[]} />);

		// The old bare spinner used fixed inset-0 with z-50. No element should
		// carry that combination anymore.
		const overlay = document.querySelector(".fixed.inset-0.z-50");
		expect(overlay).toBeNull();
	});
});

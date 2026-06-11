import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBarItem } from "../StatusBarItem";

describe("StatusBarItem", () => {
	it("forwards standard span props to the shared primitive", () => {
		render(
			<StatusBarItem
				label="Docs"
				value="12"
				id="docs-metric"
				data-testid="docs-metric"
				aria-label="Documents metric"
			/>,
		);

		const item = screen.getByTestId("docs-metric");
		expect(item).toHaveAttribute("id", "docs-metric");
		expect(item).toHaveAttribute("aria-label", "Documents metric");
		expect(item).toHaveAttribute("title", "Docs: 12");
	});
});

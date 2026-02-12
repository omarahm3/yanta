import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip } from "../Tooltip";

describe("Tooltip Integration", () => {
	it("renders children without crashing", () => {
		render(
			<Tooltip tooltipId="test" content="Test tooltip">
				<button type="button">Test Button</button>
			</Tooltip>,
		);

		expect(screen.getByRole("button")).toHaveTextContent("Test Button");
	});

	it("renders with shortcut", () => {
		render(
			<Tooltip tooltipId="test" content="Test tooltip" shortcut="Ctrl+S">
				<button type="button">Save</button>
			</Tooltip>,
		);

		expect(screen.getByRole("button")).toHaveTextContent("Save");
	});

	it("renders disabled tooltip", () => {
		render(
			<Tooltip tooltipId="test" content="Test tooltip" disabled>
				<button type="button">Test Button</button>
			</Tooltip>,
		);

		expect(screen.getByRole("button")).toHaveTextContent("Test Button");
	});
});

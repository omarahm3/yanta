import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { PaneNavigateProvider, usePaneNavigateContext } from "../PaneNavigateContext";

const Consumer: React.FC = () => {
	const navigate = usePaneNavigateContext();
	return <div data-testid="result">{navigate ? "has-handler" : "no-handler"}</div>;
};

describe("PaneNavigateContext", () => {
	it("returns null when no provider is present", () => {
		render(<Consumer />);
		expect(screen.getByTestId("result").textContent).toBe("no-handler");
	});

	it("provides the handler when wrapped in PaneNavigateProvider", () => {
		const handler = vi.fn();
		render(
			<PaneNavigateProvider value={handler}>
				<Consumer />
			</PaneNavigateProvider>,
		);
		expect(screen.getByTestId("result").textContent).toBe("has-handler");
	});
});

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TitleBarProvider } from "../../contexts";
import { TitleBar } from "../TitleBar";

const mockEnvironment = vi.fn();
const mockQuit = vi.fn();
const mockWindowMinimise = vi.fn();
const mockWindowToggleMaximise = vi.fn();

const renderWithProvider = () =>
	render(
		<TitleBarProvider>
			<TitleBar />
		</TitleBarProvider>,
	);

interface MockWindow extends Window {
	runtime: {
		Environment: typeof mockEnvironment;
		Quit: typeof mockQuit;
		WindowMinimise: typeof mockWindowMinimise;
		WindowToggleMaximise: typeof mockWindowToggleMaximise;
	};
}

describe("TitleBar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(window as unknown as MockWindow).runtime = {
			Environment: mockEnvironment,
			Quit: mockQuit,
			WindowMinimise: mockWindowMinimise,
			WindowToggleMaximise: mockWindowToggleMaximise,
		};
	});

	it("renders the custom controls on Linux", async () => {
		mockEnvironment.mockResolvedValue({ platform: "linux" });

		renderWithProvider();

		await waitFor(() => expect(screen.getByTitle("Minimize")).toBeInTheDocument());
		expect(screen.getByTitle("Maximize")).toBeInTheDocument();
		expect(screen.getByTitle("Close")).toBeInTheDocument();
		expect(mockWindowMinimise).not.toHaveBeenCalled();
	});

	it("returns null on macOS (native title bar handles dragging)", async () => {
		mockEnvironment.mockResolvedValue({ platform: "darwin" });

		const { container } = renderWithProvider();

		await waitFor(() => {
			expect(container.firstChild).toBeNull();
		});
		expect(mockWindowMinimise).not.toHaveBeenCalled();
	});
});

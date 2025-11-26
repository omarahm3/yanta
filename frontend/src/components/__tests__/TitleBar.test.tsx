import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TitleBarProvider } from "../../contexts";
import { TitleBar } from "../ui/TitleBar";

const mockIsLinux = vi.fn();
const mockIsMac = vi.fn();
const mockIsFrameless = vi.fn();

vi.mock("@wailsio/runtime", () => {
	const createIdentity = (x: unknown) => x;
	const createArrayFactory = () => (arr: unknown) => arr;
	const createMapFactory = () => (obj: unknown) => obj;
	const createNullableFactory = () => (val: unknown) => val;

	return {
		System: {
			IsLinux: () => mockIsLinux(),
			IsMac: () => mockIsMac(),
			IsWindows: () => false,
		},
		Window: {
			Minimise: vi.fn(),
			ToggleMaximise: vi.fn(),
		},
		Events: {
			On: vi.fn(() => () => {}),
			Emit: vi.fn(),
			Off: vi.fn(),
		},
		Call: {
			ByID: vi.fn(() => Promise.resolve({})),
			ByName: vi.fn(() => Promise.resolve({})),
		},
		CancellablePromise: Promise,
		Create: {
			Any: createIdentity,
			Array: createArrayFactory,
			Map: createMapFactory,
			Nullable: createNullableFactory,
			Struct: () => createIdentity,
		},
		Browser: {
			OpenURL: vi.fn(() => Promise.resolve()),
		},
	};
});

vi.mock("../../../bindings/yanta/internal/window/service", () => ({
	IsFrameless: () => mockIsFrameless(),
}));

vi.mock("../../../bindings/yanta/internal/system/service", () => ({
	BackgroundQuit: vi.fn(() => Promise.resolve()),
}));

const renderWithProvider = () =>
	render(
		<TitleBarProvider>
			<TitleBar />
		</TitleBarProvider>,
	);

describe("TitleBar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIsLinux.mockReturnValue(false);
		mockIsMac.mockReturnValue(false);
		mockIsFrameless.mockResolvedValue(true);
	});

	it("renders the custom controls on Linux", async () => {
		mockIsLinux.mockReturnValue(true);
		mockIsMac.mockReturnValue(false);

		renderWithProvider();

		await waitFor(() => expect(screen.getByTitle("Minimize")).toBeInTheDocument());
		expect(screen.getByTitle("Maximize")).toBeInTheDocument();
		expect(screen.getByTitle("Close")).toBeInTheDocument();
	});

	it("returns null on macOS (native title bar handles dragging)", async () => {
		mockIsLinux.mockReturnValue(false);
		mockIsMac.mockReturnValue(true);

		const { container } = renderWithProvider();

		await waitFor(() => {
			expect(container.firstChild).toBeNull();
		});
	});
});

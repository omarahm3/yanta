import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TitleBarProvider } from "../../context";
import { TitleBar } from "../TitleBar";

const mockIsLinux = vi.fn();
const mockIsMac = vi.fn();
const mockIsFrameless = vi.fn();
const mockEnvironment = vi.fn();

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
			Environment: () => mockEnvironment(),
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

// Mock useToast (requires ToastProvider otherwise)
vi.mock("../../../shared/ui/Toast", () => ({
	useToast: () => ({
		show: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		dismiss: vi.fn(),
		dismissAll: vi.fn(),
	}),
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
		mockIsFrameless.mockResolvedValue(true);
		mockEnvironment.mockResolvedValue({ OS: "linux" });
	});

	it("renders the custom controls on a frameless Linux window", async () => {
		mockEnvironment.mockResolvedValue({ OS: "linux" });
		mockIsFrameless.mockResolvedValue(true);

		renderWithProvider();

		await waitFor(() => expect(screen.getByTitle("Minimize")).toBeInTheDocument());
		expect(screen.getByTitle("Maximize")).toBeInTheDocument();
		expect(screen.getByTitle("Close")).toBeInTheDocument();
	});

	it("renders a draggable chrome strip on macOS", async () => {
		mockEnvironment.mockResolvedValue({ OS: "darwin" });

		const { container } = renderWithProvider();

		await waitFor(() => expect(container.firstChild).not.toBeNull());
		expect(screen.getByRole("banner", { name: "Application chrome" })).toBeInTheDocument();
	});

	it("renders nothing on natively-framed Windows (no second title bar)", async () => {
		mockEnvironment.mockResolvedValue({ OS: "windows" });

		const { container } = renderWithProvider();

		await waitFor(() => expect(mockEnvironment).toHaveBeenCalled());
		expect(container.firstChild).toBeNull();
		expect(screen.queryByRole("banner")).not.toBeInTheDocument();
	});
});

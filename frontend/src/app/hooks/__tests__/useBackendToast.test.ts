import { renderHook } from "@testing-library/react";
import { Events } from "@wailsio/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSyncStore } from "../../../shared/stores/sync.store";
import { useBackendToast } from "../useBackendToast";

const mockToast = {
	info: vi.fn(),
	success: vi.fn(),
	warning: vi.fn(),
	error: vi.fn(),
	dismiss: vi.fn(),
};

vi.mock("@wailsio/runtime", () => ({
	Events: { On: vi.fn(() => () => {}) },
	// sync.store pulls in Wails bindings (models/service) that touch these at
	// module load, so provide the minimal runtime surface they need.
	Call: { ByID: vi.fn(() => Promise.resolve({})), ByName: vi.fn(() => Promise.resolve({})) },
	CancellablePromise: Promise,
	Create: {
		Any: (x: unknown) => x,
		Array: () => (arr: unknown) => arr,
		Map: () => (obj: unknown) => obj,
		Nullable: () => (val: unknown) => val,
		Struct: () => (x: unknown) => x,
	},
}));

vi.mock("../../../shared/ui", () => ({
	useToast: () => mockToast,
}));

function getListener() {
	const onMock = Events.On as unknown as ReturnType<typeof vi.fn>;
	return onMock.mock.calls.at(-1)?.[1] as (event: {
		data?: { type?: string; message?: string; duration?: number };
	}) => void;
}

describe("useBackendToast", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useSyncStore.getState().reset();
	});

	it("routes error toasts to syncStore.lastError instead of modal", () => {
		renderHook(() => useBackendToast());
		const listener = getListener();

		listener({ data: { type: "error", message: "Auto-sync failed" } });

		expect(useSyncStore.getState().lastError).toBe("Auto-sync failed");
	});

	it("routes error toasts to toast.warning (non-modal)", () => {
		renderHook(() => useBackendToast());
		const listener = getListener();

		listener({ data: { type: "error", message: "Auto-sync failed" } });

		expect(mockToast.warning).toHaveBeenCalledWith("Auto-sync failed", { duration: 6000 });
		expect(mockToast.error).not.toHaveBeenCalled();
	});

	it("routes info toasts to toast.info", () => {
		renderHook(() => useBackendToast());
		const listener = getListener();

		listener({ data: { type: "info", message: "Info message" } });

		expect(mockToast.info).toHaveBeenCalledWith("Info message", { duration: 6000 });
	});

	it("routes success toasts to toast.success", () => {
		renderHook(() => useBackendToast());
		const listener = getListener();

		listener({ data: { type: "success", message: "Success message" } });

		expect(mockToast.success).toHaveBeenCalledWith("Success message", { duration: 6000 });
	});

	it("routes warning toasts to toast.warning", () => {
		renderHook(() => useBackendToast());
		const listener = getListener();

		listener({ data: { type: "warning", message: "Warning message" } });

		expect(mockToast.warning).toHaveBeenCalledWith("Warning message", { duration: 6000 });
	});

	it("uses custom duration from payload", () => {
		renderHook(() => useBackendToast());
		const listener = getListener();

		listener({ data: { type: "info", message: "Custom duration", duration: 10000 } });

		expect(mockToast.info).toHaveBeenCalledWith("Custom duration", { duration: 10000 });
	});
});

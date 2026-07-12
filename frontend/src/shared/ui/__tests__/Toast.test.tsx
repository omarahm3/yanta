import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "../Toast";

const TestConsumer = ({ onMount }: { onMount: (toast: ReturnType<typeof useToast>) => void }) => {
	const toast = useToast();
	onMount(toast);
	return null;
};

describe("Toast", () => {
	it("shows a toast with default duration", () => {
		let toastApi: ReturnType<typeof useToast> | null = null;
		render(
			<ToastProvider>
				<TestConsumer onMount={(t) => (toastApi = t)} />
			</ToastProvider>,
		);

		act(() => {
			toastApi?.info("Test message");
		});

		expect(screen.getByText("Test message")).toBeInTheDocument();
	});

	it("supports persistent toast with duration 0", () => {
		let toastApi: ReturnType<typeof useToast> | null = null;
		render(
			<ToastProvider>
				<TestConsumer onMount={(t) => (toastApi = t)} />
			</ToastProvider>,
		);

		act(() => {
			toastApi?.info("Persistent message", { duration: 0 });
		});

		expect(screen.getByText("Persistent message")).toBeInTheDocument();
	});

	it("supports persistent toast with duration Infinity", () => {
		let toastApi: ReturnType<typeof useToast> | null = null;
		render(
			<ToastProvider>
				<TestConsumer onMount={(t) => (toastApi = t)} />
			</ToastProvider>,
		);

		act(() => {
			toastApi?.info("Infinite message", { duration: Number.POSITIVE_INFINITY });
		});

		expect(screen.getByText("Infinite message")).toBeInTheDocument();
	});

	it("dismisses toast by id", () => {
		let toastApi: ReturnType<typeof useToast> | null = null;
		render(
			<ToastProvider>
				<TestConsumer onMount={(t) => (toastApi = t)} />
			</ToastProvider>,
		);

		let id: string;
		act(() => {
			id = toastApi!.info("Dismissable");
		});

		expect(screen.getByText("Dismissable")).toBeInTheDocument();

		act(() => {
			toastApi?.dismiss(id!);
		});

		expect(screen.queryByText("Dismissable")).not.toBeInTheDocument();
	});

	it("reuses toast id when provided", () => {
		let toastApi: ReturnType<typeof useToast> | null = null;
		render(
			<ToastProvider>
				<TestConsumer onMount={(t) => (toastApi = t)} />
			</ToastProvider>,
		);

		act(() => {
			toastApi?.info("First", { id: "my-toast" });
		});
		expect(screen.getByText("First")).toBeInTheDocument();

		act(() => {
			toastApi?.info("Second", { id: "my-toast" });
		});
		expect(screen.getByText("Second")).toBeInTheDocument();
		expect(screen.queryByText("First")).not.toBeInTheDocument();
	});

	it("error() routes to error dialog store instead of toast", () => {
		let toastApi: ReturnType<typeof useToast> | null = null;
		render(
			<ToastProvider>
				<TestConsumer onMount={(t) => (toastApi = t)} />
			</ToastProvider>,
		);

		act(() => {
			toastApi?.error("Error message");
		});

		// The error should NOT appear as a toast (it goes to the dialog instead)
		// We check that no toast viewport contains the error message
		const viewports = document.querySelectorAll("[data-radix-toast-viewport]");
		for (const viewport of viewports) {
			expect(viewport.textContent).not.toContain("Error message");
		}
	});
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { vi } from "vitest";
import { DialogProvider, HotkeyProvider } from "../contexts";
import { Search } from "../pages/Search";

const onNavigate = vi.fn();

vi.mock("../hooks/useNotification", () => ({
	useNotification: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("../hooks/useSidebarSections", () => ({
	useSidebarSections: () => [],
}));

vi.mock("../contexts", async () => {
	const actual = await vi.importActual<typeof import("../contexts")>("../contexts");
	return {
		...actual,
		useProjectContext: () => ({
			projects: [{ id: "1", alias: "alpha", name: "Alpha" }],
			setCurrentProject: vi.fn(),
		}),
	};
});

vi.mock("../../bindings/yanta/internal/search/service", () => ({
	Query: vi.fn(async () => [
		{ id: "alpha/doc1", title: "Doc1", snippet: "Snippet 1", updated: "2025" },
		{ id: "alpha/doc2", title: "Doc2", snippet: "Snippet 2", updated: "2025" },
	]),
}));

vi.mock("../../bindings/yanta/internal/tag/service", () => ({
	ListActive: vi.fn(async () => [{ name: "t1" }]),
}));

vi.mock("../components/Layout", () => ({
	Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { Query } from "../../bindings/yanta/internal/search/service";

describe("Search hotkeys", () => {
	beforeEach(() => {
		onNavigate.mockClear();
		vi.mocked(Query).mockClear();
	});

	it("renders and attaches keyboard listener", async () => {
		const spy = vi.spyOn(document, "addEventListener");

		render(
			<DialogProvider>
				<HotkeyProvider>
					<Search onNavigate={onNavigate} />
				</HotkeyProvider>
			</DialogProvider>,
		);

		const input = await screen.findByPlaceholderText(/Search entries/);
		expect(input).toBeDefined();
		expect(spy).toHaveBeenCalledWith("keydown", expect.any(Function));

		spy.mockRestore();
	});

	it("focuses input with /", async () => {
		render(
			<DialogProvider>
				<HotkeyProvider>
					<Search onNavigate={onNavigate} />
				</HotkeyProvider>
			</DialogProvider>,
		);

		const input = (await screen.findByPlaceholderText(/Search entries/)) as HTMLInputElement;
		input.blur();
		expect(document.activeElement).not.toBe(input);

		fireEvent.keyDown(document, { key: "/" });
		expect(document.activeElement).toBe(input);
	});

	it("navigates down with j", async () => {
		const { container } = render(
			<DialogProvider>
				<HotkeyProvider>
					<Search onNavigate={onNavigate} />
				</HotkeyProvider>
			</DialogProvider>,
		);

		const input = (await screen.findByPlaceholderText(/Search entries/)) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "test" } });
		await waitFor(() => expect(Query).toHaveBeenCalled());

		await screen.findByText("Doc1");
		const results = container.querySelectorAll('[data-result-item="true"]');
		(results[0] as HTMLElement).focus();

		fireEvent.keyDown(document, { key: "j" });
		await waitFor(() => expect(results[1]).toHaveFocus());
	});

	it("navigates up with k", async () => {
		const { container } = render(
			<DialogProvider>
				<HotkeyProvider>
					<Search onNavigate={onNavigate} />
				</HotkeyProvider>
			</DialogProvider>,
		);

		const input = (await screen.findByPlaceholderText(/Search entries/)) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "test" } });
		await waitFor(() => expect(Query).toHaveBeenCalled());

		await screen.findByText("Doc2");
		const results = container.querySelectorAll('[data-result-item="true"]');
		(results[1] as HTMLElement).focus();

		fireEvent.keyDown(document, { key: "k" });
		await waitFor(() => expect(results[0]).toHaveFocus());
	});

	it("moves to first result with Tab from search input", async () => {
		const { container } = render(
			<DialogProvider>
				<HotkeyProvider>
					<Search onNavigate={onNavigate} />
				</HotkeyProvider>
			</DialogProvider>,
		);

		const input = (await screen.findByPlaceholderText(/Search entries/)) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "test" } });
		await waitFor(() => expect(Query).toHaveBeenCalled());

		await screen.findByText("Doc1");
		input.focus();
		expect(document.activeElement).toBe(input);

		const results = container.querySelectorAll('[data-result-item="true"]');
		fireEvent.keyDown(document, { key: "Tab" });
		await waitFor(() => expect(results[0]).toHaveFocus());
	});

	it("blurs search input with Escape", async () => {
		render(
			<DialogProvider>
				<HotkeyProvider>
					<Search onNavigate={onNavigate} />
				</HotkeyProvider>
			</DialogProvider>,
		);

		const input = (await screen.findByPlaceholderText(/Search entries/)) as HTMLInputElement;
		input.focus();
		expect(document.activeElement).toBe(input);

		fireEvent.keyDown(document, { key: "Escape" });
		expect(document.activeElement).not.toBe(input);
	});

	it("opens result with Enter", async () => {
		const { container } = render(
			<DialogProvider>
				<HotkeyProvider>
					<Search onNavigate={onNavigate} />
				</HotkeyProvider>
			</DialogProvider>,
		);

		const input = (await screen.findByPlaceholderText(/Search entries/)) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "test" } });
		await waitFor(() => expect(Query).toHaveBeenCalled());

		await screen.findByText("Doc1");
		const results = container.querySelectorAll('[data-result-item="true"]');
		(results[0] as HTMLElement).focus();

		fireEvent.keyDown(document, { key: "Enter" });
		expect(onNavigate).toHaveBeenCalledWith("document", {
			documentPath: "alpha/doc1",
		});
	});
});

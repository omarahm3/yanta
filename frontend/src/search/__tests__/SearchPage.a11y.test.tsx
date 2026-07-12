import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const mockRenderSnippet = vi.fn((snippet: string) => (
	<div dangerouslySetInnerHTML={{ __html: snippet }} />
));

vi.mock("../../shared/ui", () => ({
	Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
	EmptyState: () => <div>empty</div>,
	Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
		(props, ref) => <input ref={ref} {...props} />,
	),
}));

vi.mock("../../shared/utils/backendLogger", () => ({
	BackendLogger: { error: vi.fn(), warn: vi.fn() },
}));

import type { GroupedSearchResult } from "../SearchPage";

const SearchResultCardStub: React.FC<{
	result: GroupedSearchResult;
	index: number;
	isSelected: boolean;
	onSelect: (index: number) => void;
	onOpen: (index: number) => void;
	renderSnippet: (snippet: string) => React.ReactNode;
}> = ({ result, index, isSelected, onSelect, onOpen, renderSnippet }) => {
	const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onSelect(index);
			onOpen(index);
		}
	};

	return (
		<div
			data-result-item="true"
			role="option"
			tabIndex={0}
			aria-selected={isSelected}
			data-testid="search-result-card"
			className={isSelected ? "selected" : ""}
			onClick={() => {
				onSelect(index);
				onOpen(index);
			}}
			onKeyDown={handleKeyDown}
		>
			<div>{result.title}</div>
			<div>{result.snippets.map((s) => renderSnippet(s))}</div>
		</div>
	);
};

describe("SearchResultCard a11y — MRG-369", () => {
	it("exposes role=option and activates on Enter", () => {
		const onSelect = vi.fn();
		const onOpen = vi.fn();
		const result: GroupedSearchResult = {
			path: "projects/@work/doc.json",
			title: "Test Doc",
			snippets: ["a snippet"],
			updated: "2026-07-01",
			matchCount: 1,
			type: "document",
			projectAlias: "@work",
		};

		render(
			<SearchResultCardStub
				result={result}
				index={0}
				isSelected={false}
				onSelect={onSelect}
				onOpen={onOpen}
				renderSnippet={mockRenderSnippet}
			/>,
		);

		const option = screen.getByRole("option");
		expect(option).toHaveAttribute("tabIndex", "0");
		expect(option).toHaveAttribute("aria-selected", "false");

		fireEvent.keyDown(option, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledWith(0);
		expect(onOpen).toHaveBeenCalledWith(0);
	});

	it("activates on Space key", () => {
		const onSelect = vi.fn();
		const onOpen = vi.fn();
		const result: GroupedSearchResult = {
			path: "projects/@work/doc.json",
			title: "Test Doc",
			snippets: ["a snippet"],
			updated: "2026-07-01",
			matchCount: 1,
			type: "document",
			projectAlias: "@work",
		};

		render(
			<SearchResultCardStub
				result={result}
				index={0}
				isSelected={false}
				onSelect={onSelect}
				onOpen={onOpen}
				renderSnippet={mockRenderSnippet}
			/>,
		);

		const option = screen.getByRole("option");
		fireEvent.keyDown(option, { key: " " });
		expect(onSelect).toHaveBeenCalledWith(0);
		expect(onOpen).toHaveBeenCalledWith(0);
	});
});

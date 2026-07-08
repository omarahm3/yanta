import { useMemo } from "react";
import { formatShortcutKeyForDisplay } from "@/config/shortcuts";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import { getMergedConfig } from "@/shared/stores/preferences.store";
import type { PageName } from "../types";
import type { FooterHint } from "../ui/FooterHintBar";

export type PageContext =
	| "dashboard"
	| "document"
	| "journal"
	| "search"
	| "settings"
	| "projects"
	| "quick-capture"
	| "test";

export interface FooterHintContext {
	currentPage: PageName;
	hasSelection?: boolean;
	documentCount?: number;
}

function fmt(configKey: string): string {
	return formatShortcutKeyForDisplay(configKey);
}

function buildDashboardHints(hasSelection: boolean, docCount: number): FooterHint[] {
	const config = getMergedConfig();
	const d = config.shortcuts.dashboard;
	const base: FooterHint[] = [
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: fmt(d.openHighlighted.key), label: "Open", priority: 1 },
		{ key: fmt(d.toggleSelection.key), label: "Select", priority: 1 },
		{ key: fmt(d.newDocument.key), label: "New", priority: 2 },
	];
	if (docCount > 0) {
		base.push({ key: fmt(d.selectAll.key), label: "Select all", priority: 2 });
	}
	if (hasSelection) {
		base.push(
			{ key: fmt(d.move.key), label: "Move", priority: 2 },
			{ key: fmt(d.restore.key), label: "Restore", priority: 3 },
			{ key: fmt(d.exportMd.key), label: "Export MD", priority: 3 },
		);
	}
	return base;
}

function buildDocumentHints(): FooterHint[] {
	const config = getMergedConfig();
	const doc = config.shortcuts.document;
	const pane = config.shortcuts.pane;
	return [
		{ key: fmt(doc.save.key), label: "Save", priority: 1 },
		{ key: fmt(doc.back.key), label: "Back", priority: 1 },
		{ key: fmt(doc.focusEditor.key), label: "Focus editor", priority: 2 },
		{ key: fmt(doc.exportMd.key), label: "Export MD", priority: 2 },
		{ key: fmt(pane.splitRight.key), label: "Split right", priority: 3 },
	];
}

function buildJournalHints(hasSelection: boolean): FooterHint[] {
	const config = getMergedConfig();
	const j = config.shortcuts.journal;
	const hints: FooterHint[] = [
		{ key: "←→", label: "Change date", priority: 1 },
		{ key: `${fmt(j.nextDay.key)}/${fmt(j.prevDay.key)}`, label: "Next/prev day", priority: 2 },
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: fmt(j.toggleSelection.key), label: "Select", priority: 2 },
	];
	if (hasSelection) {
		hints.push({ key: fmt(j.promote.key), label: "Promote", priority: 3 });
	}
	return hints;
}

function buildProjectsHints(hasSelection: boolean): FooterHint[] {
	const config = getMergedConfig();
	const p = config.shortcuts.projects;
	const hints: FooterHint[] = [
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: fmt(p.switchToSelected.key), label: "Open", priority: 1 },
		{ key: fmt(p.newProject.key), label: "New", priority: 2 },
	];
	if (hasSelection) {
		hints.push({ key: fmt(p.restore.key), label: "Restore", priority: 3 });
	}
	return hints;
}

function buildSearchHints(): FooterHint[] {
	const config = getMergedConfig();
	const s = config.shortcuts.search;
	return [
		{ key: fmt(s.focusInput.key), label: "Focus search", priority: 1 },
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: fmt(s.open.key), label: "Open", priority: 1 },
		{ key: fmt(s.toResults.key), label: "To results", priority: 2 },
	];
}

function buildQuickCaptureHints(): FooterHint[] {
	const config = getMergedConfig();
	const qc = config.shortcuts.quickCapture;
	return [
		{ key: fmt(qc.save.key), label: "Save", priority: 1 },
		{ key: fmt(qc.saveAndStay.key), label: "Save & stay", priority: 2 },
		{ key: fmt(qc.cancel.key), label: "Cancel", priority: 2 },
	];
}

function buildHintsForPage(ctx: FooterHintContext): FooterHint[] {
	const { currentPage, hasSelection = false, documentCount = 0 } = ctx;
	switch (currentPage) {
		case "dashboard":
			return buildDashboardHints(hasSelection, documentCount);
		case "document":
			return buildDocumentHints();
		case "journal":
			return buildJournalHints(hasSelection);
		case "projects":
			return buildProjectsHints(hasSelection);
		case "search":
			return buildSearchHints();
		case "settings":
			return [{ key: "j/k", label: "Navigate sections", priority: 1 }];
		case "quick-capture":
			return buildQuickCaptureHints();
		default:
			return [];
	}
}

export interface UseFooterHintsOptions {
	currentPage: PageName;
	hasSelection?: boolean;
	documentCount?: number;
}

export interface UseFooterHintsReturn {
	hints: FooterHint[];
}

export function useFooterHints({
	currentPage,
	hasSelection,
	documentCount,
}: UseFooterHintsOptions): UseFooterHintsReturn {
	const { shortcuts } = useMergedConfig();
	const hints = useMemo(() => {
		return buildHintsForPage({ currentPage, hasSelection, documentCount });
	}, [currentPage, hasSelection, documentCount, shortcuts]);

	return { hints };
}

export function getHintsForPage(page: PageContext | PageName): FooterHint[] {
	return buildHintsForPage({ currentPage: page });
}

export function getGlobalFooterHints(): FooterHint[] {
	const config = getMergedConfig();
	const g = config.shortcuts.global;
	return [
		{ key: fmt(g.commandPalette.key), label: "Commands", priority: 1 },
		{ key: "g", label: "Jump (d/j/s/p)", priority: 1 },
		{ key: fmt(g.help.key), label: "Help", priority: 1 },
	];
}

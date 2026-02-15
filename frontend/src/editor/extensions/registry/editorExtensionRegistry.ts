import type {
	BlockNoteEditor,
	BlockSpecs,
	ExtensionFactoryInstance,
	StyleSpecs,
} from "@blocknote/core";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import type { AnyExtension } from "@tiptap/core";
import { useSyncExternalStore } from "react";

// Legacy "editorExtensions" contributions. Keep broad for compatibility.
export type EditorExtensionContribution = ExtensionFactoryInstance;
export type EditorTipTapExtensionContribution = AnyExtension;
export type EditorBlockSpecContribution = BlockSpecs;
export type EditorStyleSpecContribution = StyleSpecs;

export interface EditorPluginExecutionContext {
	editor: BlockNoteEditor;
	editable: boolean;
}

export interface EditorSlashMenuItemContribution
	extends Omit<DefaultReactSuggestionItem, "onItemClick"> {
	order?: number;
	onItemClick: (ctx: EditorPluginExecutionContext) => void | Promise<void>;
}

export interface EditorToolContribution {
	id: string;
	label: string;
	description?: string;
	group?: string;
	keywords?: string[];
	action: (ctx: EditorPluginExecutionContext) => void | Promise<void>;
}

export interface EditorBlockActionContribution {
	id: string;
	label: string;
	description?: string;
	blockType?: string;
	action: (
		ctx: EditorPluginExecutionContext & {
			blockId?: string;
		},
	) => void | Promise<void>;
}

export interface EditorLifecycleHooks {
	onEditorReady?: (ctx: EditorPluginExecutionContext) => (() => void) | undefined;
	onEditorDestroy?: (ctx: EditorPluginExecutionContext) => void;
}

const extensionRegistry = new Map<string, EditorExtensionContribution[]>();
const tiptapExtensionRegistry = new Map<string, EditorTipTapExtensionContribution[]>();
const blockSpecRegistry = new Map<string, EditorBlockSpecContribution>();
const styleSpecRegistry = new Map<string, EditorStyleSpecContribution>();
const slashMenuRegistry = new Map<string, EditorSlashMenuItemContribution[]>();
const toolRegistry = new Map<string, EditorToolContribution[]>();
const blockActionRegistry = new Map<string, EditorBlockActionContribution[]>();
const lifecycleRegistry = new Map<string, EditorLifecycleHooks>();
const listeners = new Set<() => void>();
let snapshotVersion = 0;
let cachedExtensionSnapshotVersion = -1;
let cachedExtensionSnapshot: EditorExtensionContribution[] = [];
let cachedTipTapExtensionSnapshotVersion = -1;
let cachedTipTapExtensionSnapshot: EditorTipTapExtensionContribution[] = [];
let cachedBlockSpecSnapshotVersion = -1;
let cachedBlockSpecSnapshot: EditorBlockSpecContribution = {};
let cachedStyleSpecSnapshotVersion = -1;
let cachedStyleSpecSnapshot: EditorStyleSpecContribution = {};
let cachedSlashMenuSnapshotVersion = -1;
let cachedSlashMenuSnapshot: EditorSlashMenuItemContribution[] = [];
let cachedToolSnapshotVersion = -1;
let cachedToolSnapshot: EditorToolContribution[] = [];
let cachedBlockActionSnapshotVersion = -1;
let cachedBlockActionSnapshot: EditorBlockActionContribution[] = [];
let cachedLifecycleSnapshotVersion = -1;
let cachedLifecycleSnapshot: EditorLifecycleHooks[] = [];

function emitChange(): void {
	snapshotVersion += 1;
	for (const listener of listeners) {
		listener();
	}
}

export function setEditorExtensions(
	source: string,
	extensions: EditorExtensionContribution[],
): void {
	extensionRegistry.set(source, extensions);
	emitChange();
}

export function removeEditorExtensions(source: string): void {
	if (!extensionRegistry.has(source)) return;
	extensionRegistry.delete(source);
	emitChange();
}

export function getAllEditorExtensions(): EditorExtensionContribution[] {
	if (cachedExtensionSnapshotVersion === snapshotVersion) {
		return cachedExtensionSnapshot;
	}

	const result: EditorExtensionContribution[] = [];
	for (const list of extensionRegistry.values()) {
		result.push(...list);
	}
	cachedExtensionSnapshot = result;
	cachedExtensionSnapshotVersion = snapshotVersion;
	return cachedExtensionSnapshot;
}

export function setEditorTipTapExtensions(
	source: string,
	extensions: EditorTipTapExtensionContribution[],
): void {
	tiptapExtensionRegistry.set(source, extensions);
	emitChange();
}

export function removeEditorTipTapExtensions(source: string): void {
	if (!tiptapExtensionRegistry.has(source)) return;
	tiptapExtensionRegistry.delete(source);
	emitChange();
}

export function getAllEditorTipTapExtensions(): EditorTipTapExtensionContribution[] {
	if (cachedTipTapExtensionSnapshotVersion === snapshotVersion) {
		return cachedTipTapExtensionSnapshot;
	}

	const result: EditorTipTapExtensionContribution[] = [];
	for (const list of tiptapExtensionRegistry.values()) {
		result.push(...list);
	}
	cachedTipTapExtensionSnapshot = result;
	cachedTipTapExtensionSnapshotVersion = snapshotVersion;
	return cachedTipTapExtensionSnapshot;
}

export function setEditorBlockSpecs(source: string, blockSpecs: EditorBlockSpecContribution): void {
	blockSpecRegistry.set(source, blockSpecs);
	emitChange();
}

export function removeEditorBlockSpecs(source: string): void {
	if (!blockSpecRegistry.has(source)) return;
	blockSpecRegistry.delete(source);
	emitChange();
}

export function getAllEditorBlockSpecs(): EditorBlockSpecContribution {
	if (cachedBlockSpecSnapshotVersion === snapshotVersion) {
		return cachedBlockSpecSnapshot;
	}

	const result: EditorBlockSpecContribution = {};
	for (const specs of blockSpecRegistry.values()) {
		Object.assign(result, specs);
	}
	cachedBlockSpecSnapshot = result;
	cachedBlockSpecSnapshotVersion = snapshotVersion;
	return cachedBlockSpecSnapshot;
}

export function setEditorStyleSpecs(source: string, styleSpecs: EditorStyleSpecContribution): void {
	styleSpecRegistry.set(source, styleSpecs);
	emitChange();
}

export function removeEditorStyleSpecs(source: string): void {
	if (!styleSpecRegistry.has(source)) return;
	styleSpecRegistry.delete(source);
	emitChange();
}

export function getAllEditorStyleSpecs(): EditorStyleSpecContribution {
	if (cachedStyleSpecSnapshotVersion === snapshotVersion) {
		return cachedStyleSpecSnapshot;
	}

	const result: EditorStyleSpecContribution = {};
	for (const specs of styleSpecRegistry.values()) {
		Object.assign(result, specs);
	}
	cachedStyleSpecSnapshot = result;
	cachedStyleSpecSnapshotVersion = snapshotVersion;
	return cachedStyleSpecSnapshot;
}

export function setEditorSlashMenuItems(
	source: string,
	items: EditorSlashMenuItemContribution[],
): void {
	slashMenuRegistry.set(source, items);
	emitChange();
}

export function removeEditorSlashMenuItems(source: string): void {
	if (!slashMenuRegistry.has(source)) return;
	slashMenuRegistry.delete(source);
	emitChange();
}

export function getAllEditorSlashMenuItems(): EditorSlashMenuItemContribution[] {
	if (cachedSlashMenuSnapshotVersion === snapshotVersion) {
		return cachedSlashMenuSnapshot;
	}

	const result: EditorSlashMenuItemContribution[] = [];
	for (const list of slashMenuRegistry.values()) {
		result.push(...list);
	}
	result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	cachedSlashMenuSnapshot = result;
	cachedSlashMenuSnapshotVersion = snapshotVersion;
	return cachedSlashMenuSnapshot;
}

export function setEditorTools(source: string, tools: EditorToolContribution[]): void {
	toolRegistry.set(source, tools);
	emitChange();
}

export function removeEditorTools(source: string): void {
	if (!toolRegistry.has(source)) return;
	toolRegistry.delete(source);
	emitChange();
}

export function getAllEditorTools(): EditorToolContribution[] {
	if (cachedToolSnapshotVersion === snapshotVersion) {
		return cachedToolSnapshot;
	}

	const result: EditorToolContribution[] = [];
	for (const list of toolRegistry.values()) {
		result.push(...list);
	}
	cachedToolSnapshot = result;
	cachedToolSnapshotVersion = snapshotVersion;
	return cachedToolSnapshot;
}

export function setEditorBlockActions(
	source: string,
	actions: EditorBlockActionContribution[],
): void {
	blockActionRegistry.set(source, actions);
	emitChange();
}

export function removeEditorBlockActions(source: string): void {
	if (!blockActionRegistry.has(source)) return;
	blockActionRegistry.delete(source);
	emitChange();
}

export function getAllEditorBlockActions(): EditorBlockActionContribution[] {
	if (cachedBlockActionSnapshotVersion === snapshotVersion) {
		return cachedBlockActionSnapshot;
	}

	const result: EditorBlockActionContribution[] = [];
	for (const list of blockActionRegistry.values()) {
		result.push(...list);
	}
	cachedBlockActionSnapshot = result;
	cachedBlockActionSnapshotVersion = snapshotVersion;
	return cachedBlockActionSnapshot;
}

export function setEditorLifecycleHooks(source: string, hooks: EditorLifecycleHooks): void {
	lifecycleRegistry.set(source, hooks);
	emitChange();
}

export function removeEditorLifecycleHooks(source: string): void {
	if (!lifecycleRegistry.has(source)) return;
	lifecycleRegistry.delete(source);
	emitChange();
}

export function getAllEditorLifecycleHooks(): EditorLifecycleHooks[] {
	if (cachedLifecycleSnapshotVersion === snapshotVersion) {
		return cachedLifecycleSnapshot;
	}

	cachedLifecycleSnapshot = Array.from(lifecycleRegistry.values());
	cachedLifecycleSnapshotVersion = snapshotVersion;
	return cachedLifecycleSnapshot;
}

export function removeAllEditorPluginContributions(source: string): void {
	let changed = false;
	if (extensionRegistry.has(source)) {
		extensionRegistry.delete(source);
		changed = true;
	}
	if (tiptapExtensionRegistry.has(source)) {
		tiptapExtensionRegistry.delete(source);
		changed = true;
	}
	if (blockSpecRegistry.has(source)) {
		blockSpecRegistry.delete(source);
		changed = true;
	}
	if (styleSpecRegistry.has(source)) {
		styleSpecRegistry.delete(source);
		changed = true;
	}
	if (slashMenuRegistry.has(source)) {
		slashMenuRegistry.delete(source);
		changed = true;
	}
	if (toolRegistry.has(source)) {
		toolRegistry.delete(source);
		changed = true;
	}
	if (blockActionRegistry.has(source)) {
		blockActionRegistry.delete(source);
		changed = true;
	}
	if (lifecycleRegistry.has(source)) {
		lifecycleRegistry.delete(source);
		changed = true;
	}
	if (changed) {
		emitChange();
	}
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useEditorExtensions(): EditorExtensionContribution[] {
	return useSyncExternalStore(subscribe, getAllEditorExtensions, getAllEditorExtensions);
}

export function useEditorTipTapExtensions(): EditorTipTapExtensionContribution[] {
	return useSyncExternalStore(subscribe, getAllEditorTipTapExtensions, getAllEditorTipTapExtensions);
}

export function useEditorBlockSpecs(): EditorBlockSpecContribution {
	return useSyncExternalStore(subscribe, getAllEditorBlockSpecs, getAllEditorBlockSpecs);
}

export function useEditorStyleSpecs(): EditorStyleSpecContribution {
	return useSyncExternalStore(subscribe, getAllEditorStyleSpecs, getAllEditorStyleSpecs);
}

export function useEditorSlashMenuItems(): EditorSlashMenuItemContribution[] {
	return useSyncExternalStore(subscribe, getAllEditorSlashMenuItems, getAllEditorSlashMenuItems);
}

export function useEditorTools(): EditorToolContribution[] {
	return useSyncExternalStore(subscribe, getAllEditorTools, getAllEditorTools);
}

export function useEditorBlockActions(): EditorBlockActionContribution[] {
	return useSyncExternalStore(subscribe, getAllEditorBlockActions, getAllEditorBlockActions);
}

export function useEditorLifecycleHooks(): EditorLifecycleHooks[] {
	return useSyncExternalStore(subscribe, getAllEditorLifecycleHooks, getAllEditorLifecycleHooks);
}

import { useSyncExternalStore } from "react";

export type EditorExtensionContribution = unknown;

const registry = new Map<string, EditorExtensionContribution[]>();
const listeners = new Set<() => void>();
let snapshotVersion = 0;
let cachedSnapshotVersion = -1;
let cachedSnapshot: EditorExtensionContribution[] = [];

function emitChange(): void {
	snapshotVersion += 1;
	for (const listener of listeners) {
		listener();
	}
}

export function setEditorExtensions(source: string, extensions: EditorExtensionContribution[]): void {
	registry.set(source, extensions);
	emitChange();
}

export function removeEditorExtensions(source: string): void {
	if (!registry.has(source)) return;
	registry.delete(source);
	emitChange();
}

export function getAllEditorExtensions(): EditorExtensionContribution[] {
	if (cachedSnapshotVersion === snapshotVersion) {
		return cachedSnapshot;
	}

	const result: EditorExtensionContribution[] = [];
	for (const list of registry.values()) {
		result.push(...list);
	}
	cachedSnapshot = result;
	cachedSnapshotVersion = snapshotVersion;
	return cachedSnapshot;
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

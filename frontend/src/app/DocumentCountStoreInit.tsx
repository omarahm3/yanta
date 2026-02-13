import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { useDocumentCountStore } from "../shared/stores/documentCount.store";

/**
 * Loads document counts on mount and subscribes to backend events.
 * Replaces the init and subscriptions that lived in DocumentCountProvider.
 */
export function DocumentCountStoreInit() {
	useEffect(() => {
		useDocumentCountStore.getState().refreshCounts();
	}, []);

	useEffect(() => {
		const getStore = () => useDocumentCountStore.getState();
		const unsubscribers = [
			Events.On("yanta/entry/created", (ev) => {
				const projectId = ev.data?.projectId as string | undefined;
				if (projectId == null) return;
				const current = getStore().counts.get(projectId) ?? 0;
				getStore().refreshCount(projectId, current + 1);
			}),
			Events.On("yanta/entry/deleted", (ev) => {
				const projectId = ev.data?.projectId as string | undefined;
				if (projectId == null) return;
				const current = getStore().counts.get(projectId) ?? 0;
				getStore().refreshCount(projectId, Math.max(0, current - 1));
			}),
			Events.On("yanta/entry/restored", (ev) => {
				const projectId = ev.data?.projectId as string | undefined;
				if (projectId == null) return;
				const current = getStore().counts.get(projectId) ?? 0;
				getStore().refreshCount(projectId, current + 1);
			}),
			Events.On("yanta/project/entry-count", (ev) => {
				const data = ev.data as { projectId: string; count: number };
				getStore().refreshCount(data.projectId, data.count);
			}),
			Events.On("yanta/project/created", (ev) => {
				const data = ev.data as { id: string };
				getStore().refreshCount(data.id, 0);
			}),
			Events.On("yanta/project/deleted", (ev) => {
				const data = ev.data as { id: string };
				const next = new Map(getStore().counts);
				next.delete(data.id);
				useDocumentCountStore.setState({ counts: next });
			}),
		];

		return () => {
			unsubscribers.forEach((unsub) => {
				if (unsub) unsub();
			});
		};
	}, []);

	return null;
}

import type React from "react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { GetAllDocumentCounts } from "../../wailsjs/go/project/Service";
import { EventsOn } from "../../wailsjs/runtime/runtime";

interface DocumentCountContextValue {
	counts: Map<string, number>;
	getCount: (projectId: string) => number;
	refreshCounts: () => Promise<void>;
	refreshCount: (projectId: string, count: number) => void;
	isLoading: boolean;
}

const DocumentCountContext = createContext<DocumentCountContextValue | null>(null);

interface DocumentCountProviderProps {
	children: ReactNode;
}

export const DocumentCountProvider: React.FC<DocumentCountProviderProps> = ({ children }) => {
	const [counts, setCounts] = useState<Map<string, number>>(new Map());
	const [isLoading, setIsLoading] = useState(false);

	const refreshCounts = useCallback(async () => {
		try {
			setIsLoading(true);
			const countsObj = await GetAllDocumentCounts();
			const countsMap = new Map<string, number>();
			Object.entries(countsObj).forEach(([projectId, count]) => {
				countsMap.set(projectId, count as number);
			});
			setCounts(countsMap);
		} catch (err) {
			console.error("Failed to load document counts:", err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const refreshCount = useCallback((projectId: string, count: number) => {
		setCounts((prev) => {
			const next = new Map(prev);
			next.set(projectId, count);
			return next;
		});
	}, []);

	const getCount = useCallback(
		(projectId: string): number => {
			return counts.get(projectId) ?? 0;
		},
		[counts],
	);

	useEffect(() => {
		refreshCounts();
	}, [refreshCounts]);

	useEffect(() => {
		const unsubscribers = [
			EventsOn("yanta/entry/created", (data: { projectId: string }) => {
				const currentCount = counts.get(data.projectId) ?? 0;
				refreshCount(data.projectId, currentCount + 1);
			}),
			EventsOn("yanta/entry/deleted", (data: { projectId: string }) => {
				const currentCount = counts.get(data.projectId) ?? 0;
				refreshCount(data.projectId, Math.max(0, currentCount - 1));
			}),
			EventsOn("yanta/entry/restored", (data: { projectId: string }) => {
				const currentCount = counts.get(data.projectId) ?? 0;
				refreshCount(data.projectId, currentCount + 1);
			}),
			EventsOn("yanta/project/entry-count", (data: { projectId: string; count: number }) => {
				refreshCount(data.projectId, data.count);
			}),
			EventsOn("yanta/project/created", (data: { id: string }) => {
				refreshCount(data.id, 0);
			}),
			EventsOn("yanta/project/deleted", (data: { id: string }) => {
				setCounts((prev) => {
					const next = new Map(prev);
					next.delete(data.id);
					return next;
				});
			}),
		];

		return () => {
			unsubscribers.forEach((unsub) => {
				if (unsub) unsub();
			});
		};
	}, [counts, refreshCount]);

	const value: DocumentCountContextValue = {
		counts,
		getCount,
		refreshCounts,
		refreshCount,
		isLoading,
	};

	return <DocumentCountContext.Provider value={value}>{children}</DocumentCountContext.Provider>;
};

export const useDocumentCount = (): DocumentCountContextValue => {
	const context = useContext(DocumentCountContext);
	if (!context) {
		throw new Error("useDocumentCount must be used within a DocumentCountProvider");
	}
	return context;
};

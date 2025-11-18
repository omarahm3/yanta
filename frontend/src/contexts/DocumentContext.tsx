import { Events } from "@wailsio/runtime";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DocumentServiceWrapper } from "../services/DocumentService";
import type { Document } from "../types/Document";

interface DocumentContextValue {
	documents: Document[];
	isLoading: boolean;
	error: string | null;
	loadDocuments: (projectAlias: string, includeArchived?: boolean) => Promise<void>;
	refreshDocuments: () => Promise<void>;
	selectedIndex: number;
	setSelectedIndex: (index: number) => void;
	selectNext: () => void;
	selectPrevious: () => void;
	getSelectedDocument: () => Document | null;
}

const DocumentContext = createContext<DocumentContextValue | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [documents, setDocuments] = useState<Document[]>([]);
	const documentsRef = useRef<Document[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [currentProjectAlias, setCurrentProjectAlias] = useState<string | null>(null);
	const [selectedIndex, setSelectedIndex] = useState(0);

	const loadDocuments = useCallback(
		async (projectAlias: string, includeArchived: boolean = false) => {
			setIsLoading(true);
			setError(null);
			setCurrentProjectAlias(projectAlias);

			try {
				const docs = await DocumentServiceWrapper.listByProject(projectAlias, includeArchived);
				setDocuments(docs);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load documents");
			} finally {
				setIsLoading(false);
			}
		},
		[],
	);

	const refreshDocuments = useCallback(async () => {
		if (currentProjectAlias) {
			await loadDocuments(currentProjectAlias);
		}
	}, [currentProjectAlias, loadDocuments]);

	const selectNext = useCallback(() => {
		setSelectedIndex((prev) => Math.min(prev + 1, documentsRef.current.length - 1));
	}, []);

	const selectPrevious = useCallback(() => {
		setSelectedIndex((prev) => Math.max(prev - 1, 0));
	}, []);

	const getSelectedDocument = useCallback(() => {
		if (selectedIndex >= 0 && selectedIndex < documents.length) {
			return documents[selectedIndex];
		}
		return null;
	}, [selectedIndex, documents]);

	useEffect(() => {
		documentsRef.current = documents;
	}, [documents]);

	useEffect(() => {
		if (selectedIndex >= documents.length && documents.length > 0) {
			setSelectedIndex(documents.length - 1);
		}
	}, [documents.length, selectedIndex]);

	useEffect(() => {
		const unsubscribeCreated = Events.On("yanta/entry/created", () => {
			void refreshDocuments();
		});

		const unsubscribeUpdated = Events.On("yanta/entry/updated", () => {
			void refreshDocuments();
		});

		const unsubscribeDeleted = Events.On("yanta/entry/deleted", () => {
			void refreshDocuments();
		});

		const unsubscribeRestored = Events.On("yanta/entry/restored", () => {
			void refreshDocuments();
		});

		return () => {
			unsubscribeCreated();
			unsubscribeUpdated();
			unsubscribeDeleted();
			unsubscribeRestored();
		};
	}, [refreshDocuments]);

	return (
		<DocumentContext.Provider
			value={{
				documents,
				isLoading,
				error,
				loadDocuments,
				refreshDocuments,
				selectedIndex,
				setSelectedIndex,
				selectNext,
				selectPrevious,
				getSelectedDocument,
			}}
		>
			{children}
		</DocumentContext.Provider>
	);
};

export const useDocumentContext = () => {
	const context = useContext(DocumentContext);
	if (!context) {
		throw new Error("useDocumentContext must be used within DocumentProvider");
	}
	return context;
};

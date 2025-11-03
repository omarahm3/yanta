import { useEffect, useState } from "react";
import { DocumentServiceWrapper } from "../services/DocumentService";
import type { Document } from "../types/Document";

export const useDocumentLoader = (documentPath?: string) => {
	const [data, setData] = useState<Document | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!documentPath) {
			console.log("[useDocumentLoader] No document path provided, resetting state");
			setData(null);
			setIsLoading(false);
			setError(null);
			return;
		}

		const loadDocument = async () => {
			console.log("[useDocumentLoader] Starting to load document:", documentPath);
			setIsLoading(true);
			setError(null);

			try {
				console.log("[useDocumentLoader] Calling DocumentServiceWrapper.get...");
				const startTime = Date.now();
				const document = await DocumentServiceWrapper.get(documentPath);
				const loadTime = Date.now() - startTime;
				console.log(`[useDocumentLoader] Document loaded successfully in ${loadTime}ms:`, {
					path: documentPath,
					title: document.title,
					blocksCount: document.blocks?.length || 0,
				});
				setData(document);
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to load document";
				console.error("[useDocumentLoader] Error loading document:", {
					path: documentPath,
					error: err,
					message: errorMessage,
				});
				setError(errorMessage);
			} finally {
				console.log("[useDocumentLoader] Loading complete, setting isLoading to false");
				setIsLoading(false);
			}
		};

		loadDocument();
	}, [documentPath]);

	return {
		data,
		isLoading,
		error,
	};
};

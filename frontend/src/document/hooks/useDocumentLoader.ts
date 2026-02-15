import { useEffect, useRef, useState } from "react";
import { DocumentServiceWrapper } from "../../shared/services/DocumentService";
import type { Document } from "../../shared/types/Document";
import { BackendLogger } from "../../shared/utils/backendLogger";

const inflightDocumentLoads = new Map<string, Promise<Document>>();

function loadDocumentOnce(path: string): Promise<Document> {
	const existing = inflightDocumentLoads.get(path);
	if (existing) {
		return existing;
	}

	const pending = DocumentServiceWrapper.get(path).finally(() => {
		inflightDocumentLoads.delete(path);
	});
	inflightDocumentLoads.set(path, pending);
	return pending;
}

export const useDocumentLoader = (documentPath?: string) => {
	const [data, setData] = useState<Document | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const prevPathRef = useRef<string | undefined>(documentPath);

	useEffect(() => {
		if (!documentPath) {
			prevPathRef.current = documentPath;
			setData(null);
			setIsLoading(false);
			setError(null);
			return;
		}

		let cancelled = false;
		const hasPathChanged = prevPathRef.current !== documentPath;
		prevPathRef.current = documentPath;

		if (hasPathChanged) {
			setData(null);
		}

		const loadDocument = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const document = await loadDocumentOnce(documentPath);
				if (cancelled) return;
				setData(document);
			} catch (err) {
				if (cancelled) return;
				const errorMessage = err instanceof Error ? err.message : "Failed to load document";
				BackendLogger.error("[useDocumentLoader] Error loading document:", {
					path: documentPath,
					error: err,
					message: errorMessage,
				});
				setError(errorMessage);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		loadDocument();

		return () => {
			cancelled = true;
		};
	}, [documentPath]);

	return {
		data,
		isLoading,
		error,
	};
};

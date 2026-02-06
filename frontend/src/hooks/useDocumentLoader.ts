import { useEffect, useRef, useState } from "react";
import { DocumentServiceWrapper } from "../services/DocumentService";
import type { Document } from "../types/Document";
import { BackendLogger } from "../utils/backendLogger";

export const useDocumentLoader = (documentPath?: string) => {
	const [data, setData] = useState<Document | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const prevPathRef = useRef(documentPath);
	if (prevPathRef.current !== documentPath) {
		prevPathRef.current = documentPath;
		setData(null);
		setIsLoading(!!documentPath);
		setError(null);
	}

	useEffect(() => {
		if (!documentPath) {
			setData(null);
			setIsLoading(false);
			setError(null);
			return;
		}

		const loadDocument = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const document = await DocumentServiceWrapper.get(documentPath);
				setData(document);
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Failed to load document";
				BackendLogger.error("[useDocumentLoader] Error loading document:", {
					path: documentPath,
					error: err,
					message: errorMessage,
				});
				setError(errorMessage);
			} finally {
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

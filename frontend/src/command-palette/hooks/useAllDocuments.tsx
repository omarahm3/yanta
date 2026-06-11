import { FileText } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { listDocumentsByProject } from "../../shared/services/DocumentService";
import type { Project } from "../../shared/types";
import type { NavigationState, PageName } from "../../shared/types/navigation";
import type { SubPaletteItem } from "../../shared/ui";

interface UseAllDocumentsReturn {
	allDocumentItems: SubPaletteItem[];
	isLoading: boolean;
	loadAllDocuments: (projects: Project[]) => void;
}

export function useAllDocuments(
	navigate: (page: PageName, state?: NavigationState) => void,
	handleClose: () => void,
): UseAllDocumentsReturn {
	const [allDocumentItems, setAllDocumentItems] = useState<SubPaletteItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const loadedRef = useRef(false);

	const loadAllDocuments = useCallback(
		async (projects: Project[]) => {
			if (loadedRef.current || projects.length === 0) return;
			loadedRef.current = true;
			setIsLoading(true);
			try {
				const results = await Promise.all(
					projects.map((p) =>
						listDocumentsByProject(p.alias, false, 1000, 0).catch(() => []),
					),
				);
				const allDocs = results.flat();
				const items: SubPaletteItem[] = allDocs.map((doc) => ({
					id: `doc-${doc.path}`,
					icon: <FileText className="w-4 h-4" />,
					text: doc.title || "Untitled",
					hint: doc.projectAlias,
					action: () => {
						navigate("document", { path: doc.path, projectAlias: doc.projectAlias });
						handleClose();
					},
				}));
				setAllDocumentItems(items);
			} catch {
				setAllDocumentItems([]);
			} finally {
				setIsLoading(false);
			}
		},
		[navigate, handleClose],
	);

	return { allDocumentItems, isLoading, loadAllDocuments };
}

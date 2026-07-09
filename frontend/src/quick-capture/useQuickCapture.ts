import { useCallback, useRef, useState } from "react";
import { AppendEntryRequest } from "../../bindings/yanta/internal/journal/models";
import { AppendEntry } from "../../bindings/yanta/internal/journal/wailsservice";
import { BackendLogger } from "../shared/utils/backendLogger";
import { parseContent, parseProject, parseTags } from "./parser";

const LAST_PROJECT_KEY = "yanta:lastProject";

export interface SavedEntryInfo {
	id: string;
	projectAlias: string;
	date: string;
}

export interface UseQuickCaptureReturn {
	content: string;
	setContent: (content: string) => void;
	tags: string[];
	selectedProject: string | null;
	setSelectedProject: (alias: string) => void;
	error: string | null;
	isSaving: boolean;
	save: () => Promise<SavedEntryInfo | null>;
	removeTag: (tag: string) => void;
	clear: () => void;
}

interface UseQuickCaptureOptions {
	onEntrySaved?: () => void;
}

function formatLocalDate(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Derive the journal file-bucket date from the backend-assigned `created`
// timestamp rather than a fresh client clock read. The backend buckets the
// entry by its own time at write time; recomputing "today" on the client
// *after* the IPC round-trip can land on the wrong day across midnight, which
// would make Undo's DeleteEntry(date, …) target the wrong file and miss it.
function entryDate(created: unknown): string {
	if (typeof created === "string" && created) {
		const parsed = new Date(created);
		if (!Number.isNaN(parsed.getTime())) return formatLocalDate(parsed);
	}
	return formatLocalDate(new Date());
}

export function useQuickCapture(options?: UseQuickCaptureOptions): UseQuickCaptureReturn {
	const [content, setContentInternal] = useState("");
	const [tags, setTags] = useState<string[]>([]);
	const [selectedProject, setSelectedProjectInternal] = useState<string | null>(() =>
		localStorage.getItem(LAST_PROJECT_KEY),
	);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const isSavingRef = useRef(false);
	const optionsRef = useRef(options);
	optionsRef.current = options;

	// Parse content to extract tags and project
	const setContent = useCallback((newContent: string) => {
		setContentInternal(newContent);
		setTags(parseTags(newContent));

		// Update project if inline @project is found
		const inlineProject = parseProject(newContent);
		if (inlineProject) {
			setSelectedProjectInternal(inlineProject);
		}
	}, []);

	const setSelectedProject = useCallback((alias: string) => {
		setSelectedProjectInternal(alias);
	}, []);

	const save = useCallback(async (): Promise<SavedEntryInfo | null> => {
		if (isSavingRef.current) return null;

		if (!selectedProject) {
			setError("Please select a project");
			return null;
		}

		const cleanContent = parseContent(content);
		if (!cleanContent.trim()) {
			setError("Please enter some content");
			return null;
		}

		isSavingRef.current = true;
		setIsSaving(true);
		setError(null);

		try {
			const projectAlias = selectedProject.startsWith("@") ? selectedProject : `@${selectedProject}`;

			const request = new AppendEntryRequest({
				projectAlias,
				content: cleanContent,
				tags: tags,
			});

			const entry = await AppendEntry(request);
			if (!entry?.id) return null;

			optionsRef.current?.onEntrySaved?.();

			localStorage.setItem(LAST_PROJECT_KEY, projectAlias);

			setContentInternal("");
			setTags([]);

			return { id: entry.id, projectAlias, date: entryDate(entry.created) };
		} catch (err) {
			BackendLogger.error("Quick capture save failed:", err);
			setError("Failed to save. Try again.");
			return null;
		} finally {
			isSavingRef.current = false;
			setIsSaving(false);
		}
	}, [content, tags, selectedProject]);

	const removeTag = useCallback(
		(tagToRemove: string) => {
			// Remove the tag from content
			const tagPattern = new RegExp(`(^|\\s)#${tagToRemove}(?=\\s|$)`, "g");
			const newContent = content.replace(tagPattern, "$1").replace(/\s+/g, " ").trim();
			setContent(newContent);
		},
		[content, setContent],
	);

	const clear = useCallback(() => {
		setContentInternal("");
		setTags([]);
		setError(null);
	}, []);

	return {
		content,
		setContent,
		tags,
		selectedProject,
		setSelectedProject,
		error,
		isSaving,
		save,
		removeTag,
		clear,
	};
}

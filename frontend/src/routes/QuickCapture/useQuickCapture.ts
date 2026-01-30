import { useCallback, useEffect, useState } from "react";
import { AppendEntry } from "../../../bindings/yanta/internal/journal/wailsservice";
import { AppendEntryRequest } from "../../../bindings/yanta/internal/journal/models";
import { parse, parseContent, parseTags, parseProject } from "./parser";

const LAST_PROJECT_KEY = "yanta:lastProject";

export interface UseQuickCaptureReturn {
	content: string;
	setContent: (content: string) => void;
	tags: string[];
	selectedProject: string | null;
	setSelectedProject: (alias: string) => void;
	error: string | null;
	isSaving: boolean;
	save: () => Promise<boolean>;
	removeTag: (tag: string) => void;
	clear: () => void;
}

export function useQuickCapture(): UseQuickCaptureReturn {
	const [content, setContentInternal] = useState("");
	const [tags, setTags] = useState<string[]>([]);
	const [selectedProject, setSelectedProjectInternal] = useState<string | null>(
		() => localStorage.getItem(LAST_PROJECT_KEY)
	);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

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

	const save = useCallback(async (): Promise<boolean> => {
		if (!selectedProject) {
			setError("Please select a project");
			return false;
		}

		const cleanContent = parseContent(content);
		if (!cleanContent.trim()) {
			setError("Please enter some content");
			return false;
		}

		setIsSaving(true);
		setError(null);

		try {
			const projectAlias =
				selectedProject.startsWith("@") ? selectedProject : `@${selectedProject}`;

			const request = new AppendEntryRequest({
				projectAlias,
				content: cleanContent,
				tags: tags,
			});

			await AppendEntry(request);

			localStorage.setItem(LAST_PROJECT_KEY, projectAlias);

			// Clear content and tags after successful save
			setContentInternal("");
			setTags([]);

			return true;
		} catch (err) {
			setError("Failed to save. Try again.");
			throw err;
		} finally {
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
		[content, setContent]
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

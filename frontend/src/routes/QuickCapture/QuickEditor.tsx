import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type { ProjectOption } from "./ProjectPicker";

export interface QuickEditorProps {
	value: string;
	onChange: (value: string) => void;
	onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	projects?: ProjectOption[];
	maxLength?: number;
	autoFocus?: boolean;
	placeholder?: string;
	className?: string;
}

/** From cursor backward, find @ and the query (word) after it; no space allowed in query. */
function getProjectTrigger(value: string, cursorIndex: number): { start: number; query: string } | null {
	if (cursorIndex <= 0) return null;
	const before = value.slice(0, cursorIndex);
	const atMatch = before.match(/@([\w-]*)$/);
	if (!atMatch) return null;
	const start = before.length - atMatch[0].length;
	const query = atMatch[1];
	if (query.includes(" ")) return null;
	return { start, query };
}

/**
 * Textarea with syntax highlighting and inline @ project list
 * Based on PRD Section 3.7 - Syntax Highlighting
 */
export const QuickEditor: React.FC<QuickEditorProps> = ({
	value,
	onChange,
	onKeyDown,
	projects = [],
	maxLength = 10000,
	autoFocus = false,
	placeholder = "What's on your mind?",
	className,
}) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [cursorPosition, setCursorPosition] = useState(0);
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const [listDismissed, setListDismissed] = useState(false);

	const trigger = useMemo(
		() => getProjectTrigger(value, cursorPosition),
		[value, cursorPosition]
	);

	useEffect(() => {
		if (autoFocus && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [autoFocus]);

	// Re-show list when user changes the @ query
	useEffect(() => {
		setListDismissed(false);
	}, [trigger?.start, trigger?.query]);

	const filteredProjects = useMemo(() => {
		if (!trigger) return [];
		const q = trigger.query.toLowerCase();
		return projects.filter(
			(p) =>
				p.alias.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
		);
	}, [projects, trigger]);

	const showProjectList =
		trigger !== null && filteredProjects.length > 0 && !listDismissed;

	// Reset highlight when filtered list changes
	useEffect(() => {
		setHighlightedIndex(0);
	}, [trigger?.query]);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			onChange(e.target.value);
			setCursorPosition(e.target.selectionStart ?? 0);
		},
		[onChange]
	);

	const insertProject = useCallback(
		(alias: string) => {
			if (!trigger || !textareaRef.current) return;
			const before = value.slice(0, trigger.start);
			const after = value.slice(cursorPosition);
			const newValue = `${before}@${alias} ${after}`;
			onChange(newValue);
			setCursorPosition(trigger.start + alias.length + 2);
			setHighlightedIndex(0);
			// Restore focus and cursor after React updates
			requestAnimationFrame(() => {
				textareaRef.current?.focus();
				textareaRef.current?.setSelectionRange(
					trigger.start + alias.length + 2,
					trigger.start + alias.length + 2
				);
			});
		},
		[trigger, value, cursorPosition, onChange]
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (showProjectList) {
				switch (e.key) {
					case "ArrowDown":
					case "j":
						e.preventDefault();
						setHighlightedIndex((prev) =>
							prev < filteredProjects.length - 1 ? prev + 1 : prev
						);
						return;
					case "ArrowUp":
					case "k":
						e.preventDefault();
						setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
						return;
					case "Enter":
					case "Tab":
						e.preventDefault();
						if (filteredProjects[highlightedIndex]) {
							insertProject(filteredProjects[highlightedIndex].alias);
						}
						return;
					case "Escape":
						e.preventDefault();
						setListDismissed(true);
						setHighlightedIndex(0);
						return;
				}
			}
			onKeyDown?.(e);
		},
		[
			showProjectList,
			filteredProjects,
			highlightedIndex,
			insertProject,
			onKeyDown,
		]
	);

	// Sync cursor on select (e.g. click in textarea)
	const handleSelect = useCallback(() => {
		setCursorPosition(textareaRef.current?.selectionStart ?? 0);
	}, []);

	// Close project list on click outside
	useEffect(() => {
		if (!showProjectList) return;
		const handleClickOutside = (ev: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(ev.target as Node)
			) {
				setHighlightedIndex(0);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showProjectList]);

	// Generate highlighted HTML from text
	const highlightedContent = getHighlightedContent(value);

	// Show char count when near limit (8000+)
	const showCharCount = value.length >= 8000;
	const isNearLimit = value.length >= 9500;

	return (
		<div
			ref={containerRef}
			className={cn(
				"relative h-full rounded-lg border border-[#3D4F63] bg-[#232F3E]",
				className
			)}
		>
			<div
				data-testid="highlight-layer"
				className="absolute inset-0 p-3 font-mono text-sm leading-relaxed pointer-events-none whitespace-pre-wrap break-words text-[#E8E8E8] overflow-hidden rounded-lg"
				aria-hidden="true"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Intentional for syntax highlighting
				dangerouslySetInnerHTML={{ __html: highlightedContent || "&nbsp;" }}
			/>

			{/* Input layer - transparent so highlight layer is visible */}
			<textarea
				ref={textareaRef}
				value={value}
				onChange={handleChange}
				onSelect={handleSelect}
				onKeyDown={handleKeyDown}
				maxLength={maxLength}
				placeholder={placeholder}
				className="relative w-full h-full min-h-[80px] p-3 bg-transparent border-0 rounded-lg font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#61AFEF] focus:ring-inset text-transparent caret-[#E8E8E8] placeholder:text-[#5C6B7A]"
				style={{ caretColor: "#E8E8E8" }}
			/>

			{/* Inline @ project list */}
			{showProjectList && (
				<div
					data-testid="project-list"
					className="absolute left-0 right-0 top-full mt-1 bg-[#232F3E] border border-[#3D4F63] rounded-lg shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto"
				>
					{filteredProjects.map((project, index) => (
						<button
							key={project.id}
							type="button"
							role="option"
							data-highlighted={index === highlightedIndex}
							aria-selected={index === highlightedIndex}
							onClick={() => insertProject(project.alias)}
							className={cn(
								"w-full px-3 py-2 text-left text-sm transition-colors",
								index === highlightedIndex
									? "bg-[#2D3F54] text-[#61AFEF]"
									: "text-[#E8E8E8] hover:bg-[#2D3F54]"
							)}
						>
							<span className="text-[#61AFEF]">@{project.alias}</span>
							{project.name !== project.alias && (
								<span className="ml-2 text-[#5C6B7A]">{project.name}</span>
							)}
						</button>
					))}
				</div>
			)}

			{/* Character counter */}
			{showCharCount && (
				<div
					data-testid="char-counter"
					className={cn(
						"absolute bottom-2 right-2 text-xs",
						isNearLimit ? "text-[#E06C75]" : "text-[#5C6B7A]"
					)}
				>
					{value.length}/{maxLength}
				</div>
			)}
		</div>
	);
};

/**
 * Convert text to highlighted HTML
 */
function getHighlightedContent(text: string): string {
	if (!text) return "";

	// Escape HTML entities
	let html = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	// Highlight @project (blue) - must be at word boundary
	html = html.replace(
		/(^|\s)(@[\w-]+)/g,
		'$1<span class="text-[#61AFEF] font-medium">$2</span>'
	);

	// Highlight #tags (green) - must be at word boundary, not ##
	html = html.replace(
		/(^|\s)(#[\w_]+)/g,
		'$1<span class="text-[#98C379] font-medium">$2</span>'
	);

	return html;
}

import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type { ProjectOption } from "./ProjectPicker";

function escapeHtmlForMirror(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

function getProjectTrigger(
	value: string,
	cursorIndex: number,
): { start: number; query: string } | null {
	if (cursorIndex <= 0) return null;
	const before = value.slice(0, cursorIndex);
	const atMatch = before.match(/@([\w-]*)$/);
	if (!atMatch) return null;
	const start = before.length - atMatch[0].length;
	const query = atMatch[1];
	if (query.includes(" ")) return null;
	return { start, query };
}

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
	const mirrorRef = useRef<HTMLDivElement>(null);
	const projectListRef = useRef<HTMLDivElement>(null);
	const [cursorPosition, setCursorPosition] = useState(0);
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const [listDismissed, setListDismissed] = useState(false);
	const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(
		null,
	);

	const trigger = useMemo(() => getProjectTrigger(value, cursorPosition), [value, cursorPosition]);

	useEffect(() => {
		if (autoFocus && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [autoFocus]);

	useEffect(() => {
		setListDismissed(false);
	}, [trigger?.start, trigger?.query]);

	const filteredProjects = useMemo(() => {
		if (!trigger) return [];
		const q = trigger.query.toLowerCase();
		return projects.filter(
			(p) => p.alias.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
		);
	}, [projects, trigger]);

	const showProjectList = trigger !== null && filteredProjects.length > 0 && !listDismissed;

	useEffect(() => {
		setHighlightedIndex(0);
	}, [trigger?.query]);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			onChange(e.target.value);
			setCursorPosition(e.target.selectionStart ?? 0);
		},
		[onChange],
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
			requestAnimationFrame(() => {
				textareaRef.current?.focus();
				textareaRef.current?.setSelectionRange(
					trigger.start + alias.length + 2,
					trigger.start + alias.length + 2,
				);
			});
		},
		[trigger, value, cursorPosition, onChange],
	);

	const moveHighlight = useCallback(
		(direction: 1 | -1) => {
			setHighlightedIndex((prev) => {
				const len = filteredProjects.length;
				if (len === 0) return 0;
				const next = prev + direction;
				if (next < 0) return len - 1;
				if (next >= len) return 0;
				return next;
			});
		},
		[filteredProjects.length],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (showProjectList) {
				if (e.key === "ArrowDown" || e.key === "j" || (e.ctrlKey && e.key === "n")) {
					e.preventDefault();
					moveHighlight(1);
					return;
				}
				if (e.key === "ArrowUp" || e.key === "k" || (e.ctrlKey && e.key === "p")) {
					e.preventDefault();
					moveHighlight(-1);
					return;
				}
				switch (e.key) {
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
		[showProjectList, filteredProjects, highlightedIndex, insertProject, moveHighlight, onKeyDown],
	);

	const handleSelect = useCallback(() => {
		setCursorPosition(textareaRef.current?.selectionStart ?? 0);
	}, []);

	useEffect(() => {
		if (!showProjectList) return;
		const handleClickOutside = (ev: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
				setHighlightedIndex(0);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showProjectList]);

	useLayoutEffect(() => {
		if (!showProjectList || !trigger || !mirrorRef.current) {
			setDropdownPosition(null);
			return;
		}
		const mirror = mirrorRef.current;
		const before = escapeHtmlForMirror(value.slice(0, trigger.start));
		const after = escapeHtmlForMirror(value.slice(trigger.start));
		mirror.innerHTML = `${before}<span data-caret-marker="true"></span>${after}`;
		const marker = mirror.querySelector("[data-caret-marker]");
		if (marker) {
			const rect = marker.getBoundingClientRect();
			setDropdownPosition({ top: rect.bottom + 4, left: rect.left });
		} else {
			setDropdownPosition(null);
		}
	}, [showProjectList, trigger, value]);

	useLayoutEffect(() => {
		if (!showProjectList || !projectListRef.current) return;
		const highlighted = projectListRef.current.querySelector('[data-highlighted="true"]');
		if (highlighted && typeof highlighted.scrollIntoView === "function") {
			highlighted.scrollIntoView({ block: "nearest", behavior: "auto" });
		}
	}, [showProjectList, highlightedIndex]);

	const highlightedContent = getHighlightedContent(value);
	const showCharCount = value.length >= 8000;
	const isNearLimit = value.length >= 9500;

	return (
		<div
			ref={containerRef}
			className={cn(
				"relative h-full border border-glass-border/50 bg-glass-bg/30 backdrop-blur-sm rounded-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
				className,
			)}
			style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
		>
			<div
				data-testid="highlight-layer"
				className="absolute inset-0 p-3 font-mono text-sm leading-relaxed pointer-events-none whitespace-pre-wrap break-words text-text-bright overflow-hidden"
				aria-hidden="true"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Intentional for syntax highlighting
				dangerouslySetInnerHTML={{ __html: highlightedContent || "&nbsp;" }}
			/>

			{showProjectList && (
				<div
					ref={mirrorRef}
					className="absolute inset-0 p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden pointer-events-none invisible"
					aria-hidden="true"
				/>
			)}

			<textarea
				ref={textareaRef}
				value={value}
				onChange={handleChange}
				onSelect={handleSelect}
				onKeyDown={handleKeyDown}
				maxLength={maxLength}
				placeholder={placeholder}
				className="relative w-full h-full min-h-[80px] p-3 bg-transparent border-0 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-0 focus:shadow-[inset_0_0_0_2px_var(--color-accent)] text-transparent caret-text-bright placeholder:text-text-dim"
				style={{ caretColor: "var(--color-text-bright)" }}
			/>

			{showProjectList && (
				<div
					ref={projectListRef}
					data-testid="project-list"
					className="project-list-scroll bg-glass-bg/90 backdrop-blur-xl text-text border border-glass-border rounded-lg z-50 overflow-y-auto w-max max-w-[18rem] max-h-[5.75rem] py-0.5 text-xs shadow-lg"
					style={
						dropdownPosition
							? { position: "fixed", top: dropdownPosition.top, left: dropdownPosition.left }
							: { position: "absolute", left: 0, top: "100%", marginTop: 4 }
					}
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
								"w-full pr-2.5 py-1.5 text-left whitespace-nowrap transition-colors outline-none border-l-2",
								index === highlightedIndex
									? "pl-[10px] border-accent bg-accent/10"
									: "pl-2.5 border-transparent hover:bg-glass-bg/30",
							)}
						>
							<span className={index === highlightedIndex ? "text-accent font-medium" : ""}>
								@{project.alias}
							</span>
							{project.name !== project.alias && (
								<span className="ml-2 text-text-dim">{project.name}</span>
							)}
						</button>
					))}
				</div>
			)}

			{showCharCount && (
				<div
					data-testid="char-counter"
					className={cn("absolute bottom-2 right-2 text-xs", isNearLimit ? "text-red" : "text-text-dim")}
				>
					{value.length}/{maxLength}
				</div>
			)}
		</div>
	);
};

function getHighlightedContent(text: string): string {
	if (!text) return "";

	let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

	html = html.replace(/(^|\s)(@[\w-]+)/g, '$1<span class="text-accent font-medium">$2</span>');

	html = html.replace(/(^|\s)(#[\w_]+)/g, '$1<span class="text-green font-medium">$2</span>');

	return html;
}

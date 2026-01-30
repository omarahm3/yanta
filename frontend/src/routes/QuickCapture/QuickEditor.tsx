import type React from "react";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

export interface QuickEditorProps {
	value: string;
	onChange: (value: string) => void;
	onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	maxLength?: number;
	autoFocus?: boolean;
	placeholder?: string;
	className?: string;
}

/**
 * Textarea with syntax highlighting using overlay technique
 * Based on PRD Section 3.7 - Syntax Highlighting
 */
export const QuickEditor: React.FC<QuickEditorProps> = ({
	value,
	onChange,
	onKeyDown,
	maxLength = 10000,
	autoFocus = false,
	placeholder = "What's on your mind?",
	className,
}) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (autoFocus && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [autoFocus]);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value);
	};

	// Generate highlighted HTML from text
	const highlightedContent = getHighlightedContent(value);

	// Show char count when near limit (8000+)
	const showCharCount = value.length >= 8000;
	const isNearLimit = value.length >= 9500;

	return (
		<div className={cn("relative", className)}>
			{/* Highlight layer - rendered HTML with colors */}
			<div
				data-testid="highlight-layer"
				className="absolute inset-0 p-3 font-mono text-sm leading-relaxed pointer-events-none whitespace-pre-wrap break-words text-[#E8E8E8] overflow-hidden"
				aria-hidden="true"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Intentional for syntax highlighting
				dangerouslySetInnerHTML={{ __html: highlightedContent || "&nbsp;" }}
			/>

			{/* Input layer - actual textarea with transparent text */}
			<textarea
				ref={textareaRef}
				value={value}
				onChange={handleChange}
				onKeyDown={onKeyDown}
				maxLength={maxLength}
				placeholder={placeholder}
				className="relative w-full min-h-[80px] p-3 bg-[#232F3E] border border-[#3D4F63] rounded-lg font-mono text-sm leading-relaxed resize-none focus:outline-none focus:border-[#61AFEF] text-transparent caret-[#E8E8E8] placeholder:text-[#5C6B7A]"
				style={{ caretColor: "#E8E8E8" }}
			/>

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

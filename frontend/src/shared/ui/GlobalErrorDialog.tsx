import { AlertCircle, AlertTriangle, Check, Copy, Info, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useErrorDialogStore } from "../stores/errorDialog.store";
import { cn } from "../utils/cn";
import { Button } from "./Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";

/**
 * App-wide error surface. Renders the head of the global error queue as a
 * dismissible, scrollable dialog. Mounted once inside ToastProvider so every
 * `.error()` notification and every git failure is shown here instead of as a
 * toast that can grow off-screen.
 */
export const GlobalErrorDialog: React.FC = () => {
	const current = useErrorDialogStore((state) => state.queue[0] ?? null);
	const dismiss = useErrorDialogStore((state) => state.dismiss);
	const [copied, setCopied] = useState(false);
	// Retain the last error while the dialog animates closed so Radix can play
	// its exit transition instead of snapping out of the DOM on dismiss.
	const [shown, setShown] = useState(current);
	useEffect(() => {
		if (current) {
			setShown(current);
		}
	}, [current]);

	if (!shown) return null;

	const isOpen = current !== null;
	const error = shown;

	const getIcon = () => {
		switch (error.type) {
			case "CONFLICT":
				return <AlertTriangle className="size-6 shrink-0 text-yellow-500" aria-hidden="true" />;
			case "INFO":
				return <Info className="size-6 shrink-0 text-blue-500" aria-hidden="true" />;
			default:
				return <AlertCircle className="size-6 shrink-0 text-red-500" aria-hidden="true" />;
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			dismiss();
		}
	};

	const handleCopy = async () => {
		if (!navigator?.clipboard?.writeText) {
			return;
		}
		try {
			await navigator.clipboard.writeText(error.technicalDetails);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard unavailable (e.g. denied permission) — nothing to do.
		}
	};

	const hasSuggestions = error.suggestions.length > 0;
	const hasDetails = error.technicalDetails.trim().length > 0;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className={cn(
					"sm:max-w-2xl p-0 bg-glass-bg/90 backdrop-blur-xl border-glass-border overflow-hidden",
				)}
				showCloseButton={false}
			>
				{/* Header */}
				<DialogHeader className="flex flex-row items-start justify-between gap-3 px-6 py-4 border-b border-glass-border">
					<div className="flex items-center gap-3 min-w-0">
						{getIcon()}
						<DialogTitle className="text-lg font-semibold text-text-bright truncate">
							{error.title}
						</DialogTitle>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={dismiss}
						aria-label="Close"
						className="shrink-0 p-1 text-text-dim hover:text-text-bright"
					>
						<X className="size-5" aria-hidden="true" />
					</Button>
				</DialogHeader>

				{/* Body */}
				<div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-4">
					<DialogDescription className="text-sm leading-relaxed text-text">
						{error.message}
					</DialogDescription>

					{hasSuggestions && (
						<div className="flex flex-col gap-2">
							<p className="text-xs font-semibold uppercase tracking-wide text-text-dim">
								What you can do
							</p>
							<ol className="flex flex-col gap-1.5">
								{error.suggestions.map((suggestion, index) => (
									<li key={suggestion} className="flex gap-2 text-sm text-text">
										<span className="select-none text-text-dim">{index + 1}.</span>
										<span>{suggestion}</span>
									</li>
								))}
							</ol>
						</div>
					)}

					{hasDetails && (
						<div className="rounded-lg border border-glass-border bg-glass-bg/20">
							<div className="flex items-center justify-between px-4 py-2 border-b border-glass-border">
								<span className="text-xs font-medium text-text-dim">Technical details</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleCopy}
									className="gap-1.5 text-text-dim hover:text-text-bright"
								>
									{copied ? (
										<Check className="size-3.5" aria-hidden="true" />
									) : (
										<Copy className="size-3.5" aria-hidden="true" />
									)}
									{copied ? "Copied" : "Copy"}
								</Button>
							</div>
							<pre className="max-h-64 overflow-auto px-4 py-3 text-xs font-mono leading-relaxed text-text-dim whitespace-pre-wrap break-words">
								{error.technicalDetails}
							</pre>
						</div>
					)}
				</div>

				{/* Footer */}
				<DialogFooter className="px-6 py-4 border-t border-glass-border">
					<Button variant="primary" onClick={dismiss}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

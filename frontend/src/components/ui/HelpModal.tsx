import type React from "react";
import { useEffect } from "react";
import { GLOBAL_COMMANDS } from "../../constants/globalCommands";
import { useHotkeyContext } from "../../contexts/HotkeyContext";
import { useHelp } from "../../hooks/useHelp";
import { Heading } from "../ui";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "./dialog";

const formatHotkeyDisplay = (key: string): string => {
	return key
		.replace(/mod/gi, "Ctrl")
		.replace(/shift/gi, "Shift")
		.replace(/alt/gi, "Alt")
		.replace(/meta/gi, "Meta")
		.replace(/\+/g, "+")
		.split("+")
		.map((part) => {
			const keyMap: Record<string, string> = {
				Escape: "ESC",
				" ": "SPACE",
				Enter: "ENTER",
				Tab: "TAB",
				ArrowUp: "↑",
				ArrowDown: "↓",
				ArrowLeft: "←",
				ArrowRight: "→",
			};
			return keyMap[part] || part.toUpperCase();
		})
		.join("+");
};

export const HelpModal: React.FC = () => {
	const { isOpen, closeHelp, pageCommands, pageName } = useHelp();
	const { getRegisteredHotkeys } = useHotkeyContext();

	useEffect(() => {
		if (!isOpen) return;

		const handleQuestion = (e: KeyboardEvent) => {
			if (e.key === "?") {
				e.preventDefault();
				closeHelp();
			}
		};

		document.addEventListener("keydown", handleQuestion);
		return () => document.removeEventListener("keydown", handleQuestion);
	}, [isOpen, closeHelp]);

	const allHotkeys =
		pageName === "SETTINGS"
			? []
			: getRegisteredHotkeys()
					.filter((h) => h.description && h.description !== "Toggle help")
					.sort((a, b) => (a.description ?? "").localeCompare(b.description ?? ""));

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			closeHelp();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-full max-w-4xl max-h-[85vh] overflow-hidden bg-surface border-2 border-accent/30 p-0"
				style={{
					boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(88, 166, 255, 0.2)",
				}}
				showCloseButton={false}
			>
				<DialogHeader className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-border/40">
					<DialogTitle className="text-lg sm:text-xl font-bold tracking-wide text-accent">
						HELP
					</DialogTitle>
					<div className="text-xs text-text-dim font-mono hidden sm:block">
						Press <span className="text-accent font-semibold">ESC</span> or{" "}
						<span className="text-accent font-semibold">?</span> to close
					</div>
				</DialogHeader>

				<div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-80px)] text-left">
					<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
						<div>
							<Heading
								as="h3"
								variant="dim"
								size="sm"
								weight="bold"
								className="mb-4 sm:mb-6 tracking-wider uppercase"
							>
								GLOBAL COMMANDS
							</Heading>
							<div className="space-y-3 sm:space-y-4">
								{GLOBAL_COMMANDS.map((cmd, idx) => (
									<div key={idx} className="flex items-start gap-3 sm:gap-4 font-mono text-sm group">
										<div className="shrink-0">
											<code className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-bg border border-green/20 rounded-md text-green font-medium transition-all duration-200 group-hover:border-green/40 group-hover:bg-green/5 text-xs sm:text-sm">
												:{cmd.command}
											</code>
										</div>
										<div className="flex-1 pt-0.5 sm:pt-1 text-text leading-relaxed text-xs sm:text-sm">
											{cmd.description}
										</div>
									</div>
								))}
							</div>
						</div>

						{pageCommands.length > 0 && (
							<div>
								<Heading
									as="h3"
									variant="dim"
									size="sm"
									weight="bold"
									className="mb-4 sm:mb-6 tracking-wider uppercase"
								>
									{pageName} COMMANDS
								</Heading>
								<div className="space-y-3 sm:space-y-4">
									{pageCommands.map((cmd, idx) => (
										<div key={idx} className="flex items-start gap-3 sm:gap-4 font-mono text-sm group">
											<div className="shrink-0">
												<code className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-bg border border-accent/20 rounded-md text-accent font-medium transition-all duration-200 group-hover:border-accent/40 group-hover:bg-accent/5 text-xs sm:text-sm">
													{cmd.command}
												</code>
											</div>
											<div className="flex-1 pt-0.5 sm:pt-1 text-text leading-relaxed text-xs sm:text-sm">
												{cmd.description}
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{allHotkeys.length > 0 && (
							<div>
								<Heading
									as="h3"
									variant="dim"
									size="sm"
									weight="bold"
									className="mb-4 sm:mb-6 tracking-wider uppercase"
								>
									KEYBOARD SHORTCUTS
								</Heading>
								<div className="space-y-3 sm:space-y-4">
									{allHotkeys.map((hotkey) => (
										<div
											key={hotkey.id}
											className="flex items-start gap-3 sm:gap-4 font-mono text-sm group"
										>
											<div className="shrink-0">
												<code className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-bg border border-purple/20 rounded-md text-purple font-medium transition-all duration-200 group-hover:border-purple/40 group-hover:bg-purple/5 text-xs sm:text-sm">
													{formatHotkeyDisplay(hotkey.key)}
												</code>
											</div>
											<div className="flex-1 pt-0.5 sm:pt-1 text-text leading-relaxed text-xs sm:text-sm">
												{hotkey.description}
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					{pageCommands.length === 0 && allHotkeys.length === 0 && (
						<div className="py-12 px-6 text-center">
							{pageName === "SETTINGS" ? (
								<div className="space-y-4">
									<div className="text-6xl">🤔</div>
									<div className="text-lg font-semibold text-text">Looking for keyboard shortcuts?</div>
									<div className="text-text-dim">They're literally right there on the page! ↓</div>
									<div className="text-sm text-text-dim/70 italic">
										(Scroll up if you can't see them)
									</div>
								</div>
							) : (
								<div className="text-text-dim">No page-specific commands or shortcuts available.</div>
							)}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};

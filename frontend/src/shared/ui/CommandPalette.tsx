import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import { getCommandIdForKeyboardEvent } from "../utils/shortcuts";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "./command";

export interface CommandOption {
	id: string;
	icon: React.ReactNode;
	text: string;
	hint?: string;
	shortcut?: string;
	group?: string;
	keywords?: string[];
	action: () => void;
	/** When true, keeps the palette open after selecting (e.g. for sub-palette transitions) */
	keepOpen?: boolean;
	/** When true, displays a subtle "Recent" indicator for this command */
	isRecent?: boolean;
}

export interface SubPaletteItem {
	id: string;
	icon?: React.ReactNode;
	text: string;
	hint?: string;
	action: () => void;
}

export interface NoteResult {
	path: string;
	title: string;
	projectAlias: string;
	type: "document" | "note";
	noteId?: string;
}

// Define the canonical group order
const GROUP_ORDER = ["Navigation", "Create", "Document", "Git", "Projects", "Application"] as const;

// Helper to sort commands by group
function groupCommands(commands: CommandOption[]): Map<string, CommandOption[]> {
	const grouped = new Map<string, CommandOption[]>();

	// Initialize groups in order
	for (const groupName of GROUP_ORDER) {
		grouped.set(groupName, []);
	}
	// Add an "Other" group for commands without a group
	grouped.set("Other", []);

	// Assign commands to groups
	for (const command of commands) {
		const group = command.group || "Other";
		const groupCommands = grouped.get(group);
		if (groupCommands) {
			groupCommands.push(command);
		} else {
			// Unknown group, add to Other
			grouped.get("Other")?.push(command);
		}
	}

	// Remove empty groups
	for (const [groupName, cmds] of grouped) {
		if (cmds.length === 0) {
			grouped.delete(groupName);
		}
	}

	return grouped;
}

interface CommandPaletteItemProps {
	command: CommandOption;
	onSelect: (command: CommandOption) => void;
}

const CommandPaletteItem: React.FC<CommandPaletteItemProps> = React.memo(
	({ command, onSelect }) => {
		const handleSelect = useCallback(() => {
			onSelect(command);
		}, [command, onSelect]);

		return (
			<CommandItem
				value={[command.text, ...(command.keywords || []), command.shortcut].filter(Boolean).join(" ")}
				keywords={command.hint ? [command.hint] : undefined}
				onSelect={handleSelect}
			>
				<span className="w-5">{command.icon}</span>
				<span className="flex-1">{command.text}</span>
				{command.isRecent && (
					<span
						className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-primary/60"
						aria-label="Recently used"
						data-testid="recent-indicator"
					/>
				)}
				{command.shortcut ? (
					<kbd className="ml-auto rounded border border-glass-border bg-bg-dark/40 px-2 py-1 text-xs font-mono text-text-dim/80 shadow-sm font-semibold tracking-widest">
						{command.shortcut}
					</kbd>
				) : (
					command.hint && <CommandShortcut>{command.hint}</CommandShortcut>
				)}
			</CommandItem>
		);
	},
);
CommandPaletteItem.displayName = "CommandPaletteItem";

interface SubPaletteItemRowProps {
	item: SubPaletteItem;
	onSelect: (item: SubPaletteItem) => void;
}

const SubPaletteItemRow: React.FC<SubPaletteItemRowProps> = React.memo(({ item, onSelect }) => {
	const handleSelect = useCallback(() => {
		onSelect(item);
	}, [item, onSelect]);

	return (
		<CommandItem value={item.text} onSelect={handleSelect}>
			{item.icon && <span className="w-5">{item.icon}</span>}
			<span className="flex-1">{item.text}</span>
			{item.hint && <CommandShortcut>{item.hint}</CommandShortcut>}
		</CommandItem>
	);
});
SubPaletteItemRow.displayName = "SubPaletteItemRow";

interface NoteResultRowProps {
	result: NoteResult;
	onSelect: (result: NoteResult) => void;
}

const NoteResultRow: React.FC<NoteResultRowProps> = React.memo(({ result, onSelect }) => {
	const handleSelect = useCallback(() => {
		onSelect(result);
	}, [result, onSelect]);

	return (
		<CommandItem value={result.title} onSelect={handleSelect}>
			<span className="w-5">
				<FileText className="size-4 text-text-dim" aria-hidden="true" />
			</span>
			<span className="flex-1 truncate">{result.title}</span>
			{result.projectAlias && <CommandShortcut>{result.projectAlias}</CommandShortcut>}
		</CommandItem>
	);
});
NoteResultRow.displayName = "NoteResultRow";

export interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	onCommandSelect: (command: CommandOption) => void;
	commands: CommandOption[];
	placeholder?: string;
	subPaletteItems?: SubPaletteItem[];
	subPaletteTitle?: string;
	onSubPaletteBack?: () => void;
	/** Recently used commands shown at the top in their own group */
	recentCommands?: CommandOption[];
	/** Note results from quick-switcher title search */
	noteResults?: NoteResult[];
	/** True while note search is in-flight */
	isSearchingNotes?: boolean;
	/** Callback fired when the search input value changes */
	onSearchChange?: (value: string) => void;
	/** Called when user selects a note from note results */
	onNoteSelect?: (result: NoteResult) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
	isOpen,
	onClose,
	onCommandSelect,
	commands,
	placeholder = "Type a command...",
	subPaletteItems,
	subPaletteTitle,
	onSubPaletteBack,
	recentCommands,
	noteResults,
	isSearchingNotes,
	onSearchChange,
	onNoteSelect,
}) => {
	const isSubPaletteMode = !!subPaletteItems;

	const handleSelect = useCallback(
		(command: CommandOption) => {
			command.action();
			onCommandSelect(command);
			if (!command.keepOpen) {
				onClose();
			}
		},
		[onCommandSelect, onClose],
	);

	const handleSubPaletteSelect = useCallback(
		(item: SubPaletteItem) => {
			item.action();
			onClose();
		},
		[onClose],
	);

	const handleNoteSelect = useCallback(
		(result: NoteResult) => {
			onNoteSelect?.(result);
			onClose();
		},
		[onNoteSelect, onClose],
	);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				onClose();
			}
		},
		[onClose],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (isSubPaletteMode && e.key === "Escape" && onSubPaletteBack) {
				e.preventDefault();
				e.stopPropagation();
				onSubPaletteBack();
				return;
			}
			const mod = e.ctrlKey || e.metaKey;
			if (mod && e.key === "n") {
				e.preventDefault();
				e.stopPropagation();
				const el = e.currentTarget as HTMLElement;
				el.dispatchEvent(
					new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
				);
				return;
			}
			if (mod && e.key === "p") {
				e.preventDefault();
				e.stopPropagation();
				const el = e.currentTarget as HTMLElement;
				el.dispatchEvent(
					new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
				);
				return;
			}
			const commandId = getCommandIdForKeyboardEvent(e.nativeEvent);
			if (commandId) {
				const command = commands.find((c) => c.id === commandId);
				if (command) {
					e.preventDefault();
					e.stopPropagation();
					handleSelect(command);
				}
			}
		},
		[isSubPaletteMode, onSubPaletteBack, commands, handleSelect],
	);

	const groupedCommands = useMemo(() => groupCommands(commands), [commands]);

	const hasRecentCommands = recentCommands && recentCommands.length > 0;
	const hasNoteResults = noteResults && noteResults.length > 0;

	return (
		<CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
			<div onKeyDown={handleKeyDown}>
				{isSubPaletteMode && (
					<div className="flex items-center gap-2 px-3 py-2 border-b border-glass-border">
						<button
							type="button"
							onClick={onSubPaletteBack}
							className="p-1 rounded hover:bg-muted transition-colors"
							aria-label="Go back"
						>
							<ArrowLeft className="w-4 h-4" />
						</button>
						<span className="text-sm font-medium">{subPaletteTitle}</span>
					</div>
				)}
				<CommandInput
					placeholder={isSubPaletteMode ? `Search ${subPaletteTitle?.toLowerCase()}...` : placeholder}
					onValueChange={onSearchChange}
				/>
				<CommandList>
					{isSubPaletteMode ? (
						<>
							<CommandEmpty>No items found.</CommandEmpty>
							<CommandGroup>
								{subPaletteItems.map((item) => (
									<SubPaletteItemRow key={item.id} item={item} onSelect={handleSubPaletteSelect} />
								))}
							</CommandGroup>
						</>
					) : (
						<>
							<CommandEmpty>
								{isSearchingNotes ? (
									<span className="flex items-center justify-center gap-2">
										<Loader2 className="size-4 animate-spin" aria-hidden="true" />
										Searching notes…
									</span>
								) : (
									"No commands found."
								)}
							</CommandEmpty>

							{/* Recent Actions — always at the top when present */}
							{hasRecentCommands && (
								<CommandGroup heading="Recent" data-testid="recent-group">
									{recentCommands.map((command) => (
										<CommandPaletteItem
											key={`recent-${command.id}`}
											command={command}
											onSelect={handleSelect}
										/>
									))}
								</CommandGroup>
							)}

							{/* Grouped commands */}
							{Array.from(groupedCommands.entries()).map(([groupName, groupCmds]) => (
								<CommandGroup key={groupName} heading={groupName}>
									{groupCmds.map((command) => (
										<CommandPaletteItem key={command.id} command={command} onSelect={handleSelect} />
									))}
								</CommandGroup>
							))}

							{/* Note quick-switcher results */}
							{hasNoteResults && (
								<CommandGroup heading="Notes" data-testid="notes-group">
									{noteResults.map((result) => (
										<NoteResultRow
											key={result.path}
											result={result}
											onSelect={handleNoteSelect}
										/>
									))}
								</CommandGroup>
							)}
						</>
					)}
				</CommandList>
			</div>
		</CommandDialog>
	);
};

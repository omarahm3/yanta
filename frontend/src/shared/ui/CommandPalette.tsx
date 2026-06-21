import { ArrowLeft, CornerDownLeft } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import { getCommandIdForKeyboardEvent } from "../utils/shortcuts";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
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

// Define the canonical group order — Documents first for quick-switcher
const GROUP_ORDER = ["Documents", "Navigation", "Create", "Document", "Git", "Projects", "Application"] as const;

// Helper to sort commands by group
function groupCommands(commands: CommandOption[]): Map<string, CommandOption[]> {
	const grouped = new Map<string, CommandOption[]>();

	for (const groupName of GROUP_ORDER) {
		grouped.set(groupName, []);
	}
	grouped.set("Other", []);

	for (const command of commands) {
		const group = command.group || "Other";
		const groupCommands = grouped.get(group);
		if (groupCommands) {
			groupCommands.push(command);
		} else {
			grouped.get("Other")?.push(command);
		}
	}

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
				{command.icon ? (
					<span className="w-4 shrink-0 text-text-dim">{command.icon}</span>
				) : (
					<span className="w-4 shrink-0" />
				)}
				<span className="flex-1 truncate">{command.text}</span>
				{command.isRecent && (
					<span
						className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-accent/60"
						aria-label="Recently used"
						data-testid="recent-indicator"
					/>
				)}
				{command.shortcut ? (
					<kbd className="ml-2 shrink-0 rounded border border-glass-border bg-bg-dark/40 px-1.5 py-0.5 text-[11px] font-mono text-text-dim/70 shadow-sm font-semibold tracking-wider">
						{command.shortcut}
					</kbd>
				) : command.hint ? (
					<span data-slot="command-shortcut" className="ml-2 shrink-0 text-[11px] text-text-dim/50">{command.hint}</span>
				) : null}
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
			{item.icon ? <span className="w-4 shrink-0 text-text-dim">{item.icon}</span> : <span className="w-4 shrink-0" />}
			<span className="flex-1 truncate">{item.text}</span>
			{item.hint && (
				<span className="ml-2 shrink-0 text-[11px] text-text-dim/60">{item.hint}</span>
			)}
		</CommandItem>
	);
});
SubPaletteItemRow.displayName = "SubPaletteItemRow";

export interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	onCommandSelect: (command: CommandOption) => void;
	commands: CommandOption[];
	placeholder?: string;
	subPaletteItems?: SubPaletteItem[];
	subPaletteTitle?: string;
	onSubPaletteBack?: () => void;
}

const FOOTER_HINTS = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "↵", label: "Select" },
	{ key: "Esc", label: "Close" },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
	isOpen,
	onClose,
	onCommandSelect,
	commands,
	placeholder = "Type a command or search documents...",
	subPaletteItems,
	subPaletteTitle,
	onSubPaletteBack,
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

	const footerHints = useMemo(
		() => (
			<div className="flex items-center gap-4 border-t border-glass-border px-4 py-2">
				{FOOTER_HINTS.map((hint) => (
					<span key={hint.key} className="flex items-center gap-1.5 text-[11px] text-text-dim/50">
						<kbd className="rounded border border-glass-border bg-bg-dark/30 px-1.5 py-0.5 text-[10px] font-mono text-text-dim/60">
							{hint.key}
						</kbd>
						<span>{hint.label}</span>
					</span>
				))}
			</div>
		),
		[],
	);

	return (
		<CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
			<div onKeyDown={handleKeyDown}>
				{isSubPaletteMode && (
					<div className="flex items-center gap-2 px-3 py-2 border-b border-glass-border">
						<button
							type="button"
							onClick={onSubPaletteBack}
							className="p-1 rounded hover:bg-accent/10 transition-colors"
							aria-label="Go back"
						>
							<ArrowLeft className="w-4 h-4 text-text-dim" />
						</button>
						<span className="text-sm font-medium text-text">{subPaletteTitle}</span>
					</div>
				)}
				<CommandInput
					placeholder={isSubPaletteMode ? `Search ${subPaletteTitle?.toLowerCase()}...` : placeholder}
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
								<div className="flex flex-col items-center gap-1">
									<span>No commands found</span>
									<span className="text-xs text-text-dim/50">Try a different search term</span>
								</div>
							</CommandEmpty>
							{Array.from(groupedCommands.entries()).map(([groupName, groupCmds]) => (
								<CommandGroup key={groupName} heading={groupName}>
									{groupCmds.map((command) => (
										<CommandPaletteItem key={command.id} command={command} onSelect={handleSelect} />
									))}
								</CommandGroup>
							))}
						</>
					)}
				</CommandList>
				{!isSubPaletteMode && footerHints}
			</div>
		</CommandDialog>
	);
};

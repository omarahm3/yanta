import { ArrowLeft } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@/components/ui/command";
import { getCommandIdForKeyboardEvent } from "../../utils/shortcuts";

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
					<kbd className="ml-auto rounded border border-glass-border bg-bg-dark/40 px-1.5 py-0.5 text-xs font-mono text-text-dim/80 shadow-sm font-semibold tracking-widest">
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

export const CommandPalette: React.FC<CommandPaletteProps> = ({
	isOpen,
	onClose,
	onCommandSelect,
	commands,
	placeholder = "Type a command...",
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
							<CommandEmpty>No commands found.</CommandEmpty>
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
			</div>
		</CommandDialog>
	);
};

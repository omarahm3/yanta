import type React from "react";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useProjectContext, useTitleBarContext } from "../contexts";
import { useGlobalCommand, useHotkeys } from "../hooks";
import { useNotification } from "../hooks/useNotification";
import { HeaderBar, type SidebarSection, Sidebar as UISidebar } from "./ui";
import { CommandLine } from "./ui/commandline";

export interface LayoutProps {
	sidebarTitle?: string;
	sidebarSections?: SidebarSection[];
	sidebarContent?: ReactNode;
	breadcrumb?: string;
	currentPage: string;
	headerShortcuts?: Array<{
		key: string;
		label: string;
	}>;
	children: ReactNode;
	showCommandLine?: boolean;
	commandContext?: string;
	commandPlaceholder?: string;
	commandValue?: string;
	onCommandChange?: (value: string) => void;
	onCommandSubmit?: (command: string) => void;
	commandInputRef?: React.RefObject<HTMLInputElement>;
}

export const Layout: React.FC<LayoutProps> = ({
	sidebarTitle: _sidebarTitle,
	sidebarSections,
	sidebarContent,
	breadcrumb,
	currentPage,
	headerShortcuts = [],
	children,
	showCommandLine = false,
	commandContext = "YANTA",
	commandPlaceholder = "type command or press / for help",
	commandValue = "",
	onCommandChange,
	onCommandSubmit,
	commandInputRef: providedRef,
}) => {
	const internalRef = useRef<HTMLInputElement>(null);
	const commandInputRef = providedRef || internalRef;
	const { executeGlobalCommand } = useGlobalCommand();
	const { success, error } = useNotification();
	const [sidebarVisible, setSidebarVisible] = useState(true);
	const { currentProject } = useProjectContext();
	const { heightInRem } = useTitleBarContext();

	const handleCommandSubmit = useCallback(
		async (command: string) => {
			const globalResult = await executeGlobalCommand(command);

			if (globalResult.handled) {
				if (globalResult.success) {
					if (globalResult.message) {
						success(globalResult.message);
					}
				} else {
					if (globalResult.message) {
						error(globalResult.message);
					}
				}

				if (onCommandChange) {
					onCommandChange("");
				}
				commandInputRef.current?.blur();
				return;
			}

			if (onCommandSubmit) {
				onCommandSubmit(command);
				commandInputRef.current?.blur();
			}
		},
		[executeGlobalCommand, onCommandSubmit, onCommandChange, success, error, commandInputRef],
	);

	const sidebarToggleHotkeys = useMemo(
		() => [
			{
				key: "ctrl+b",
				handler: () => {
					setSidebarVisible((prev) => !prev);
				},
				allowInInput: false,
				description: "Toggle sidebar",
			},
			{
				key: "mod+e",
				handler: () => {
					setSidebarVisible((prev) => !prev);
				},
				allowInInput: false,
				description: "Toggle sidebar",
			},
		],
		[],
	);

	useHotkeys(sidebarToggleHotkeys);

	const commandLineHotkeys = useMemo(
		() =>
			showCommandLine
				? [
						{
							key: "shift+;",
							handler: () => {
								if (commandInputRef.current) {
									commandInputRef.current.focus();
								}
							},
							allowInInput: false,
							description: "Focus command line",
						},
						{
							key: "Escape",
							handler: (event: KeyboardEvent) => {
								const target = event.target as HTMLElement;
								if (target === commandInputRef.current) {
									event.preventDefault();
									event.stopPropagation();
									commandInputRef.current?.blur();
									if (onCommandChange) {
										onCommandChange("");
									}
									return true;
								}
								return false;
							},
							allowInInput: true,
							priority: 100,
							description: "Exit command line",
							capture: true,
						},
					]
				: [],
		[showCommandLine, commandInputRef, onCommandChange],
	);

	useHotkeys(commandLineHotkeys);

	return (
		<div
			data-testid="layout-root"
			data-sidebar-visible={sidebarVisible ? "true" : "false"}
			className="flex overflow-hidden font-mono text-sm leading-relaxed bg-bg text-text"
			style={{ height: `calc(100vh - ${heightInRem}rem)` }}
		>
			{sidebarVisible &&
				(sidebarContent ? sidebarContent : <UISidebar sections={sidebarSections || []} />)}

			<div className="flex flex-col flex-1 overflow-hidden">
				<HeaderBar
					breadcrumb={
						breadcrumb || (currentPage === "settings" ? "Settings" : currentProject?.name || "No Project")
					}
					currentPage={currentPage}
					shortcuts={headerShortcuts}
				/>

				<div className="flex-1 overflow-hidden">{children}</div>

				{showCommandLine && onCommandChange && (
					<CommandLine
						ref={commandInputRef}
						context={commandContext}
						placeholder={commandPlaceholder}
						value={commandValue}
						onChange={onCommandChange}
						onSubmit={handleCommandSubmit}
					/>
				)}
			</div>
		</div>
	);
};

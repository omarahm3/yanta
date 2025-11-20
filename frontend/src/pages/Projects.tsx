import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectResult } from "../../bindings/yanta/internal/commandline/models";
import { Parse } from "../../bindings/yanta/internal/commandline/projectcommands";
import { Layout } from "../components/Layout";
import { Table, type TableColumn, type TableRow } from "../components/ui";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ProjectCommand } from "../constants";
import { useProjectContext } from "../contexts";
import { useHelp, useHotkeys } from "../hooks";
import { useNotification } from "../hooks/useNotification";
import { useSidebarSections } from "../hooks/useSidebarSections";
import { type ExtendedProject, extendProject, type HelpCommand } from "../types";
import { getProjectAliasColor } from "../utils/colorUtils";

const helpCommands: HelpCommand[] = [
	{
		command: `${ProjectCommand.ProjectCommandNew} [name] [alias] [start-date] [end-date]`,
		description: "Create a new project (name: no spaces, dates: DD-MM-YYYY or YYYY-MM-DD)",
	},
	{
		command: `${ProjectCommand.ProjectCommandArchive} [alias]`,
		description: "Archive a project",
	},
	{
		command: `${ProjectCommand.ProjectCommandUnarchive} [alias]`,
		description: "Restore archived project",
	},
	{
		command: `${ProjectCommand.ProjectCommandRename} [alias] [new-name]`,
		description: "Rename a project",
	},
	{
		command: `${ProjectCommand.ProjectCommandDelete} [alias]`,
		description: "Delete a project (safe - warns if has entries)",
	},
	{
		command: `${ProjectCommand.ProjectCommandDelete} [alias] --force`,
		description: "Soft delete project and all entries (can be restored)",
	},
	{
		command: `${ProjectCommand.ProjectCommandDelete} [alias] --force --hard`,
		description: "PERMANENT deletion - removes ALL files from vault (⚠️ cannot be undone)",
	},
];

interface ProjectsProps {
	onNavigate?: (page: string) => void;
}

export const Projects: React.FC<ProjectsProps> = ({ onNavigate }) => {
	const { currentProject, setCurrentProject, projects, archivedProjects, loadProjects, isLoading } =
		useProjectContext();
	const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProject?.id || "");
	const [commandInput, setCommandInput] = useState("");
	const [confirmDialog, setConfirmDialog] = useState<{
		isOpen: boolean;
		title: string;
		message: string;
		onConfirm: () => void;
		danger?: boolean;
		inputPrompt?: string;
		expectedInput?: string;
		showCheckbox?: boolean;
	}>({
		isOpen: false,
		title: "",
		message: "",
		onConfirm: () => {},
	});
	const { success, error } = useNotification();
	const { setPageContext } = useHelp();
	const commandInputRef = useRef<HTMLInputElement>(null);
	const projectsRef = useRef(projects);
	const archivedProjectsRef = useRef(archivedProjects);
	const selectedProjectIdRef = useRef(selectedProjectId);

	useEffect(() => {
		projectsRef.current = projects;
		archivedProjectsRef.current = archivedProjects;
		selectedProjectIdRef.current = selectedProjectId;
	}, [projects, archivedProjects, selectedProjectId]);

	useEffect(() => {
		setPageContext(helpCommands, "Projects");
	}, [setPageContext]);

	useEffect(() => {
		if (currentProject) {
			setSelectedProjectId(currentProject.id);
		}
	}, [currentProject]);

	useEffect(() => {
		if (projects.length > 0 && !selectedProjectId) {
			setSelectedProjectId(projects[0].id);
		}
	}, [projects, selectedProjectId]);

	const activeProjectDetails = projects.map((p) => ({
		...extendProject(p, false),
		entryCount: 0,
		lastEntry: "-",
	}));
	const archivedProjectDetails = archivedProjects.map((p) => ({
		...extendProject(p, true),
		entryCount: 0,
		lastEntry: "-",
	}));

	const tableColumns: TableColumn[] = [
		{ key: "number", label: "", width: "30px" },
		{ key: "name", label: "NAME", width: "200px" },
		{ key: "alias", label: "ALIAS", width: "100px" },
		{ key: "type", label: "TYPE", width: "150px" },
		{ key: "entryCount", label: "ENTRIES", width: "100px", align: "right" },
		{ key: "lastEntry", label: "LAST ENTRY", width: "150px" },
		{ key: "status", label: "STATUS", width: "auto" },
	];

	const formatTableRows = (projects: ExtendedProject[]): TableRow[] => {
		return projects.map((project, index) => ({
			id: project.id,
			number: index + 1,
			name: project.name,
			alias: (
				<span className="font-mono" style={{ color: getProjectAliasColor(project.alias) }}>
					{project.alias}
				</span>
			),
			type: "Project",
			entryCount: project.entryCount,
			lastEntry: project.lastEntry,
			status: (
				<span
					className={`text-xs ${
						project.status === "current"
							? "text-green"
							: project.status === "active"
								? "text-green"
								: "text-text-dim"
					}`}
				>
					{project.status}
				</span>
			),
		}));
	};

	const handleRowSelect = useCallback(
		(row: TableRow) => {
			setSelectedProjectId(row.id);
			const project = projects.find((p) => p.id === row.id);
			if (project) {
				setCurrentProject(project);
			}
		},
		[projects, setCurrentProject],
	);

	const handleRowDoubleClick = useCallback(
		(row: TableRow) => {
			const project = projects.find((p) => p.id === row.id);
			if (project) {
				setCurrentProject(project);
				success(`Switched to ${project.name}`);
			}
		},
		[projects, setCurrentProject, success],
	);

	const handleCommandSubmit = useCallback(
		async (command: string) => {
			const normalized = command.startsWith(":") ? command.slice(1).trimStart() : command;

			const allProjects = [...projects, ...archivedProjects];

			const applyResult = async (result: ProjectResult | undefined | null) => {
				if (!result) return;

				if (!result.success) {
					if (result.message) {
						error(result.message);
					}
					return;
				}

				await loadProjects();
				if (result.data?.project?.id) {
					setSelectedProjectId(result.data.project.id);
				}

				if (result.message) {
					success(result.message, { duration: 6000 });
				}

				setCommandInput("");
				commandInputRef.current?.blur();
			};

			const hardForceMatch = normalized.match(/^delete\s+(@[\w-]+)\s+--force\s+--hard$/);
			if (hardForceMatch) {
				const alias = hardForceMatch[1];
				const project = allProjects.find((p) => p.alias === alias);
				if (project) {
					commandInputRef.current?.blur();
					setConfirmDialog({
						isOpen: true,
						title: "Permanently Delete Project",
						message: `This will PERMANENTLY delete project "${project.name}" and ALL its documents from the vault. All files will be removed and CANNOT be recovered!`,
						inputPrompt: `Type the project alias to confirm:`,
						expectedInput: alias,
						onConfirm: () => {
							void (async () => {
								const result = await Parse(normalized);
								await applyResult(result);
								setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
								setTimeout(() => commandInputRef.current?.focus(), 0);
							})();
						},
						danger: true,
						showCheckbox: true,
					});
					return;
				}
			}

			try {
				const preview = await Parse(normalized);

				if (!preview) {
					error("Command returned null");
					return;
				}

				if (!preview.success) {
					if (preview.message) {
						error(preview.message);
					}
					return;
				}

				const data = preview.data;
				const alias = data?.alias || data?.project?.alias;

				if (data?.requiresConfirmation && data.confirmationCommand && alias) {
					const project = allProjects.find((p) => p.alias === alias);
					const projectName = project ? project.name : alias;
					const isHard = data.flags?.includes("--hard") ?? false;
					const confirmationCommand = data.confirmationCommand!;
					const isArchive = normalized.startsWith("archive ");
					const isDelete = normalized.startsWith("delete ");

					let title = "Confirm Action";
					let message = preview.message || "Confirm this action?";
					let danger = false;
					let inputPrompt: string | undefined;
					let expectedInput: string | undefined;
					let showCheckbox = false;

					if (isArchive) {
						title = "Archive Project";
						message =
							preview.message || `This will archive project "${projectName}". You can restore it later.`;
						danger = false;
					} else if (isDelete) {
						if (isHard) {
							title = "Permanently Delete Project";
							message =
								preview.message ||
								`This will PERMANENTLY delete project "${projectName}" and ALL its documents from the vault. All files will be removed and CANNOT be recovered!`;
							inputPrompt = `Type the project alias to confirm:`;
							expectedInput = alias;
							showCheckbox = true;
							danger = true;
						} else {
							title = "Delete Project";
							message =
								preview.message ||
								`This will delete project "${projectName}" and archive all of its documents. You can restore them later.`;
							danger = false;
						}
					}

					commandInputRef.current?.blur();
					setConfirmDialog({
						isOpen: true,
						title,
						message,
						inputPrompt,
						expectedInput,
						showCheckbox,
						danger,
						onConfirm: () => {
							void (async () => {
								const result = await Parse(confirmationCommand);
								await applyResult(result);
								setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
								setTimeout(() => commandInputRef.current?.focus(), 0);
							})();
						},
					});
					return;
				}

				await applyResult(preview);
			} catch (err) {
				error(err instanceof Error ? err.message : "Command failed");
			}
		},
		[projects, archivedProjects, loadProjects, error, success],
	);

	const selectNext = useCallback(() => {
		const allProjects = [...projectsRef.current, ...archivedProjectsRef.current];
		const currentIndex = allProjects.findIndex((p) => p.id === selectedProjectIdRef.current);
		if (currentIndex < allProjects.length - 1) {
			const nextProject = allProjects[currentIndex + 1];
			setSelectedProjectId(nextProject.id);
		}
	}, []);

	const selectPrevious = useCallback(() => {
		const allProjects = [...projectsRef.current, ...archivedProjectsRef.current];
		const currentIndex = allProjects.findIndex((p) => p.id === selectedProjectIdRef.current);
		if (currentIndex > 0) {
			const prevProject = allProjects[currentIndex - 1];
			setSelectedProjectId(prevProject.id);
		}
	}, []);

	const selectCurrentProject = useCallback(() => {
		const allProjects = [...projectsRef.current, ...archivedProjectsRef.current];
		const project = allProjects.find((p) => p.id === selectedProjectIdRef.current);
		if (project) {
			setCurrentProject(project);
			success(`Switched to ${project.name}`);
		}
	}, [setCurrentProject, success]);

	const projectHotkeys = useMemo(() => [
		{
			key: "j",
			handler: selectNext,
			allowInInput: false,
			description: "Select next project",
		},
		{
			key: "k",
			handler: selectPrevious,
			allowInInput: false,
			description: "Select previous project",
		},
		{
			key: "ArrowDown",
			handler: selectNext,
			allowInInput: false,
			description: "Select next project",
		},
		{
			key: "ArrowUp",
			handler: selectPrevious,
			allowInInput: false,
			description: "Select previous project",
		},
		{
			key: "Enter",
			handler: selectCurrentProject,
			allowInInput: false,
			description: "Switch to selected project",
		},
		{
			key: "mod+N",
			handler: () => {
				setCommandInput("new ");
				setTimeout(() => {
					commandInputRef.current?.focus();
					const len = "new ".length;
					commandInputRef.current?.setSelectionRange(len, len);
				}, 0);
			},
			allowInInput: false,
			description: "Create a new project",
		},
		{
			key: "mod+A",
			handler: () => {
				const selected = projectsRef.current.find((p) => p.id === selectedProjectIdRef.current);
				if (selected) {
					setCommandInput(`archive `);
					setTimeout(() => {
						commandInputRef.current?.focus();
						const len = `archive `.length;
						commandInputRef.current?.setSelectionRange(len, len);
					}, 0);
				}
			},
			allowInInput: false,
			description: "Archive a project",
		},
		{
			key: "mod+U",
			handler: () => {
				const selected = projectsRef.current.find((p) => p.id === selectedProjectIdRef.current);
				if (selected) {
					setCommandInput(`unarchive `);
					setTimeout(() => {
						commandInputRef.current?.focus();
						const len = `unarchive `.length;
						commandInputRef.current?.setSelectionRange(len, len);
					}, 0);
				}
			},
			allowInInput: false,
			description: "Restore archived project",
		},
		{
			key: "mod+R",
			handler: () => {
				const selected = projectsRef.current.find((p) => p.id === selectedProjectIdRef.current);
				if (selected) {
					setCommandInput(`rename ${selected.alias} `);
					setTimeout(() => {
						commandInputRef.current?.focus();
						const len = `rename ${selected.alias} `.length;
						commandInputRef.current?.setSelectionRange(len, len);
					}, 0);
				}
			},
			allowInInput: false,
			description: "Rename a project",
		},
		{
			key: "mod+D",
			handler: () => {
				const selected = projectsRef.current.find((p) => p.id === selectedProjectIdRef.current);
				if (selected) {
					setCommandInput(`delete ${selected.alias}`);
					setTimeout(() => {
						commandInputRef.current?.focus();
						const len = `delete ${selected.alias}`.length;
						commandInputRef.current?.setSelectionRange(len, len);
					}, 0);
				}
			},
			allowInInput: false,
			description: "Delete a project",
		},
	], [selectNext, selectPrevious, selectCurrentProject, setCommandInput, commandInputRef, projectsRef, selectedProjectIdRef]);

	useHotkeys(projectHotkeys);

	const sidebarSections = useSidebarSections({
		currentPage: "projects",
		onNavigate,
	});

	return (
		<>
			<Layout
				sidebarSections={sidebarSections}
				currentPage="projects"
				showCommandLine={true}
				commandContext="project"
				commandPlaceholder="type command or press / for help"
				commandValue={commandInput}
				onCommandChange={setCommandInput}
				onCommandSubmit={handleCommandSubmit}
				commandInputRef={commandInputRef}
			>
				<div className="p-5">
					<div className="mb-4 text-xs font-semibold tracking-wider uppercase text-text-dim">
						ACTIVE PROJECTS
					</div>

					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-text-dim">Loading projects...</div>
						</div>
					) : (
						<Table
							columns={tableColumns}
							rows={formatTableRows(activeProjectDetails)}
							selectedRowId={selectedProjectId}
							onRowSelect={handleRowSelect}
							onRowDoubleClick={handleRowDoubleClick}
							className="max-w-4xl"
						/>
					)}

					{archivedProjectDetails.length > 0 && (
						<>
							<div className="mt-8 mb-4 text-xs font-semibold tracking-wider uppercase text-text-dim">
								ARCHIVED PROJECTS
							</div>

							<Table
								columns={tableColumns}
								rows={formatTableRows(archivedProjectDetails)}
								selectedRowId={selectedProjectId}
								onRowSelect={handleRowSelect}
								onRowDoubleClick={handleRowDoubleClick}
								className="max-w-4xl opacity-60"
							/>
						</>
					)}
				</div>
			</Layout>
			<ConfirmDialog
				isOpen={confirmDialog.isOpen}
				title={confirmDialog.title}
				message={confirmDialog.message}
				onConfirm={confirmDialog.onConfirm}
				onCancel={() => {
					setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
					setTimeout(() => commandInputRef.current?.focus(), 0);
				}}
				danger={confirmDialog.danger}
				inputPrompt={confirmDialog.inputPrompt}
				expectedInput={confirmDialog.expectedInput}
				showCheckbox={confirmDialog.showCheckbox}
			/>
		</>
	);
};

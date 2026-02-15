import { formatRelative } from "date-fns";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/app";
import type { ProjectResult } from "../../bindings/yanta/internal/commandline/models";
import { Parse } from "../../bindings/yanta/internal/commandline/projectcommands";
import {
	Create as CreateProject,
	GetAllDocumentCounts,
	GetAllLastDocumentDates,
} from "../../bindings/yanta/internal/project/service";
import { PROJECTS_SHORTCUTS } from "@/config/public";
import { useHotkeys } from "../hotkeys";
import { useNotification, useSidebarSections } from "../shared/hooks";
import { type ExtendedProject, extendProject, type PageName } from "../shared/types";
import { Table, type TableColumn, type TableRow } from "../shared/ui";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { BackendLogger } from "../shared/utils/backendLogger";
import { getProjectAliasColor } from "../shared/utils/color";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { useProjectContext } from "./context";

interface ProjectsProps {
	onNavigate?: (page: PageName) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

const ProjectsComponent: React.FC<ProjectsProps> = ({ onNavigate, onRegisterToggleSidebar }) => {
	const { currentProject, setCurrentProject, projects, archivedProjects, loadProjects, isLoading } =
		useProjectContext();
	const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProject?.id || "");
	const [documentCounts, setDocumentCounts] = useState<Record<string, number | undefined>>({});
	const [lastDocumentDates, setLastDocumentDates] = useState<Record<string, string | undefined>>({});
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
	const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
	const { success, error: notifyError } = useNotification();
	const projectsRef = useRef(projects);
	const archivedProjectsRef = useRef(archivedProjects);
	const selectedProjectIdRef = useRef(selectedProjectId);

	useEffect(() => {
		projectsRef.current = projects;
		archivedProjectsRef.current = archivedProjects;
		selectedProjectIdRef.current = selectedProjectId;
	}, [projects, archivedProjects, selectedProjectId]);

	const fetchDocumentData = useCallback(async () => {
		try {
			const [counts, dates] = await Promise.all([GetAllDocumentCounts(), GetAllLastDocumentDates()]);
			setDocumentCounts(counts || {});
			setLastDocumentDates(dates || {});
		} catch (err) {
			BackendLogger.error("Failed to fetch document counts and dates:", err);
			notifyError("Failed to load document counts");
		}
	}, [notifyError]);

	useEffect(() => {
		if (projects.length > 0 || archivedProjects.length > 0) {
			fetchDocumentData();
		}
	}, [projects, archivedProjects, fetchDocumentData]);

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

	const activeProjectDetails = useMemo(
		() =>
			projects.map((p) => ({
				...extendProject(p, false),
				entryCount: documentCounts[p.id] || 0,
				lastEntry: lastDocumentDates[p.id] || "-",
			})),
		[projects, documentCounts, lastDocumentDates],
	);

	const archivedProjectDetails = useMemo(
		() =>
			archivedProjects.map((p) => ({
				...extendProject(p, true),
				entryCount: documentCounts[p.id] || 0,
				lastEntry: lastDocumentDates[p.id] || "-",
			})),
		[archivedProjects, documentCounts, lastDocumentDates],
	);

	const tableColumns: TableColumn[] = [
		{ key: "number", label: "", width: "30px" },
		{ key: "name", label: "NAME", width: "minmax(100px, 2fr)" },
		{ key: "alias", label: "ALIAS", width: "minmax(80px, 1fr)" },
		{ key: "type", label: "TYPE", width: "minmax(80px, 0.8fr)" },
		{ key: "entryCount", label: "ENTRIES", width: "minmax(60px, 0.5fr)", align: "right" },
		{ key: "lastEntry", label: "LAST ENTRY", width: "minmax(120px, 1.2fr)" },
		{ key: "status", label: "STATUS", width: "minmax(5rem, 0.8fr)" },
	];

	const formatTableRows = (projects: ExtendedProject[]): TableRow[] => {
		return projects.map((project, index) => {
			const raw = String(project.lastEntry).replace(/\s+/g, " ").trim();
			let lastEntryDisplay: string;
			if (!raw || raw === "-") lastEntryDisplay = "-";
			else {
				const date = new Date(raw);
				lastEntryDisplay = Number.isNaN(date.getTime()) ? raw : formatRelative(date, new Date());
			}
			const statusActive = project.status === "current" || project.status === "active";
			return {
				id: project.id,
				number: index + 1,
				name: (
					<span className="block truncate" title={project.name}>
						{project.name}
					</span>
				),
				alias: (
					<span
						className="block truncate font-mono"
						style={{ color: getProjectAliasColor(project.alias) }}
						title={project.alias}
					>
						{project.alias}
					</span>
				),
				type: "Project",
				entryCount: project.entryCount,
				lastEntry: <span title={lastEntryDisplay}>{lastEntryDisplay}</span>,
				status: (
					<span
						className={`inline-block shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
							statusActive ? "bg-green/20 text-green" : "bg-border text-text-dim"
						}`}
					>
						{project.status}
					</span>
				),
			};
		});
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
			}
		},
		[projects, setCurrentProject],
	);

	const applyResult = useCallback(
		async (result: ProjectResult | undefined | null) => {
			if (!result) return;

			if (!result.success) {
				if (result.message) {
					notifyError(result.message);
				}
				return;
			}

			await loadProjects();
			await fetchDocumentData();

			if (result.data?.project?.id) {
				setSelectedProjectId(result.data.project.id);
			}

			if (result.message) {
				success(result.message, { duration: 6000 });
			}
		},
		[loadProjects, fetchDocumentData, notifyError, success],
	);

	const executeProjectCommand = useCallback(
		async (command: string) => {
			const allProjects = [...projects, ...archivedProjects];

			const hardForceMatch = command.match(/^delete\s+(@[\w-]+)\s+--force\s+--hard$/);
			if (hardForceMatch) {
				const alias = hardForceMatch[1];
				const project = allProjects.find((p) => p.alias === alias);
				if (project) {
					setConfirmDialog({
						isOpen: true,
						title: "Permanently Delete Project",
						message: `This will PERMANENTLY delete project "${project.name}" and ALL its documents from the vault. All files will be removed and CANNOT be recovered!`,
						inputPrompt: `Type the project alias to confirm:`,
						expectedInput: alias,
						onConfirm: () => {
							void (async () => {
								const result = await Parse(command);
								await applyResult(result);
								setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
							})();
						},
						danger: true,
						showCheckbox: true,
					});
					return;
				}
			}

			try {
				const preview = await Parse(command);

				if (!preview) {
					notifyError("Command returned null");
					return;
				}

				if (!preview.success) {
					if (preview.message) {
						notifyError(preview.message);
					}
					return;
				}

				const data = preview.data;
				const alias = data?.alias || data?.project?.alias;

				if (data?.requiresConfirmation && data.confirmationCommand && alias) {
					const project = allProjects.find((p) => p.alias === alias);
					const projectName = project ? project.name : alias;
					const isHard = data.flags?.includes("--hard") ?? false;
					const confirmationCommand = data.confirmationCommand;
					const isArchive = command.startsWith("archive ");
					const isDelete = command.startsWith("delete ");

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
							})();
						},
					});
					return;
				}

				await applyResult(preview);
			} catch (err) {
				notifyError(err instanceof Error ? err.message : "Command failed");
			}
		},
		[projects, archivedProjects, applyResult, notifyError],
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
		}
	}, [setCurrentProject]);

	const handleCreateProject = useCallback(
		async (data: { name: string; alias: string; startDate: string; endDate: string }) => {
			try {
				const projectId = await CreateProject(data.name, data.alias, data.startDate, data.endDate);
				await loadProjects();
				await fetchDocumentData();
				setSelectedProjectId(projectId);
				setIsNewProjectDialogOpen(false);
			} catch (err) {
				notifyError(err instanceof Error ? err.message : "Failed to create project");
			}
		},
		[loadProjects, fetchDocumentData, notifyError],
	);

	const projectHotkeys = useMemo(
		() => [
			{
				...PROJECTS_SHORTCUTS.newProject,
				handler: () => setIsNewProjectDialogOpen(true),
				allowInInput: false,
			},
			{ ...PROJECTS_SHORTCUTS.selectNext, handler: selectNext, allowInInput: false },
			{ ...PROJECTS_SHORTCUTS.selectPrev, handler: selectPrevious, allowInInput: false },
			{ ...PROJECTS_SHORTCUTS.arrowDown, handler: selectNext, allowInInput: false },
			{ ...PROJECTS_SHORTCUTS.arrowUp, handler: selectPrevious, allowInInput: false },
			{
				...PROJECTS_SHORTCUTS.switchToSelected,
				handler: selectCurrentProject,
				allowInInput: false,
			},
			{
				...PROJECTS_SHORTCUTS.archive,
				handler: () => {
					const selected = projectsRef.current.find((p) => p.id === selectedProjectIdRef.current);
					if (selected) {
						void executeProjectCommand(`archive ${selected.alias}`);
					}
				},
				allowInInput: false,
			},
			{
				...PROJECTS_SHORTCUTS.restore,
				handler: () => {
					const selected = archivedProjectsRef.current.find(
						(p) => p.id === selectedProjectIdRef.current,
					);
					if (selected) {
						void executeProjectCommand(`unarchive ${selected.alias}`);
					}
				},
				allowInInput: false,
			},
			{
				...PROJECTS_SHORTCUTS.delete,
				handler: () => {
					const selected = projectsRef.current.find((p) => p.id === selectedProjectIdRef.current);
					if (selected) {
						void executeProjectCommand(`delete ${selected.alias}`);
					}
				},
				allowInInput: false,
			},
			{
				...PROJECTS_SHORTCUTS.permanentDelete,
				handler: () => {
					const allProjects = [...projectsRef.current, ...archivedProjectsRef.current];
					const selected = allProjects.find((p) => p.id === selectedProjectIdRef.current);
					if (selected) {
						void executeProjectCommand(`delete ${selected.alias} --hard`);
					}
				},
				allowInInput: false,
			},
		],
		[selectNext, selectPrevious, selectCurrentProject, executeProjectCommand],
	);

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
				onRegisterToggleSidebar={onRegisterToggleSidebar}
			>
				<div className="min-w-0 w-full p-5">
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
							className="w-full"
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
								className="w-full opacity-60"
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
				onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
				danger={confirmDialog.danger}
				inputPrompt={confirmDialog.inputPrompt}
				expectedInput={confirmDialog.expectedInput}
				showCheckbox={confirmDialog.showCheckbox}
			/>
			<NewProjectDialog
				isOpen={isNewProjectDialogOpen}
				onClose={() => setIsNewProjectDialogOpen(false)}
				onSubmit={handleCreateProject}
			/>
		</>
	);
};

export const Projects = React.memo(ProjectsComponent);


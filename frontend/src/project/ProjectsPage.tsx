import { formatRelative } from "date-fns";
import { Archive, ArchiveRestore, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/app";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import type { ProjectResult } from "../../bindings/yanta/internal/commandline/models";
import { Parse } from "../../bindings/yanta/internal/commandline/projectcommands";
import {
	Create as CreateProject,
	GetAllDocumentCounts,
	GetAllLastDocumentDates,
} from "../../bindings/yanta/internal/project/service";
import { useHotkeys } from "../hotkeys";
import { useNotification, useSidebarSections } from "../shared/hooks";
import { type ExtendedProject, extendProject, type PageName } from "../shared/types";
import { EmptyState, Table, type TableColumn, type TableRow } from "../shared/ui";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { BackendLogger } from "../shared/utils/backendLogger";
import { getProjectAliasColor } from "../shared/utils/color";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { RenameProjectDialog } from "./components/RenameProjectDialog";
import { useProjectContext } from "./context";
import { useProjectManageStore } from "./projectManage.store";

type ProjectSortField = "name" | "alias" | "entryCount" | "lastEntry";
type SortDir = "asc" | "desc";

const PROJECT_SORT_KEY = "yanta:projectSort";

function readProjectSort(): { field: ProjectSortField; direction: SortDir } {
	try {
		if (typeof window === "undefined") return { field: "name", direction: "asc" };
		const raw = window.localStorage.getItem(PROJECT_SORT_KEY);
		if (!raw) return { field: "name", direction: "asc" };
		const parsed = JSON.parse(raw);
		if (
			parsed &&
			["name", "alias", "entryCount", "lastEntry"].includes(parsed.field) &&
			(parsed.direction === "asc" || parsed.direction === "desc")
		) {
			return parsed;
		}
	} catch {
		// ignore
	}
	return { field: "name", direction: "asc" };
}

function writeProjectSort(config: { field: ProjectSortField; direction: SortDir }): void {
	try {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(PROJECT_SORT_KEY, JSON.stringify(config));
	} catch {
		// ignore
	}
}

/**
 * Sorts the (already-extended) project rows. Shared by the active and archived
 * lists so their ordering rules can never drift apart. The `lastEntry`
 * comparator returns 0 when both entries are missing so it stays a valid strict
 * weak ordering (returning 1 both ways would violate the sort contract).
 */
export function sortExtendedProjects<
	T extends { name: string; alias: string; entryCount: number; lastEntry: unknown },
>(list: T[], { field, direction }: { field: ProjectSortField; direction: SortDir }): T[] {
	const mult = direction === "asc" ? 1 : -1;
	return [...list].sort((a, b) => {
		if (field === "name") return mult * a.name.localeCompare(b.name);
		if (field === "alias") return mult * a.alias.localeCompare(b.alias);
		if (field === "entryCount") return mult * (a.entryCount - b.entryCount);
		if (field === "lastEntry") {
			const aRaw = String(a.lastEntry).replace(/\s+/g, " ").trim();
			const bRaw = String(b.lastEntry).replace(/\s+/g, " ").trim();
			const aMissing = !aRaw || aRaw === "-";
			const bMissing = !bRaw || bRaw === "-";
			if (aMissing && bMissing) return 0;
			if (aMissing) return 1;
			if (bMissing) return -1;
			return mult * (new Date(aRaw).getTime() - new Date(bRaw).getTime());
		}
		return 0;
	});
}

/** Alias + name is all the row actions and rename dialog need. */
interface ProjectActionTarget {
	alias: string;
	name: string;
}

interface RowActions {
	onRename: (target: ProjectActionTarget) => void;
	onArchive: (target: ProjectActionTarget) => void;
	onRestore: (target: ProjectActionTarget) => void;
	onDelete: (target: ProjectActionTarget) => void;
	onHardDelete: (target: ProjectActionTarget) => void;
}

const rowActionButton =
	"flex h-6 w-6 items-center justify-center rounded text-text-dim transition-colors hover:bg-accent/10 hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent";

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
	const [renameTarget, setRenameTarget] = useState<ProjectActionTarget | null>(null);
	const [projectSort, setProjectSort] = useState(readProjectSort);
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

	const activeProjectDetails = useMemo(() => {
		const extended = projects.map((p) => ({
			...extendProject(p, false),
			entryCount: documentCounts[p.id] || 0,
			lastEntry: lastDocumentDates[p.id] || "-",
		}));
		return sortExtendedProjects(extended, projectSort);
	}, [projects, documentCounts, lastDocumentDates, projectSort]);

	const archivedProjectDetails = useMemo(() => {
		const extended = archivedProjects.map((p) => ({
			...extendProject(p, true),
			entryCount: documentCounts[p.id] || 0,
			lastEntry: lastDocumentDates[p.id] || "-",
		}));
		return sortExtendedProjects(extended, projectSort);
	}, [archivedProjects, documentCounts, lastDocumentDates, projectSort]);

	const handleProjectSort = useCallback((field: ProjectSortField) => {
		setProjectSort((prev) => {
			const next =
				prev.field === field
					? { field, direction: (prev.direction === "asc" ? "desc" : "asc") as SortDir }
					: { field, direction: (field === "name" || field === "alias" ? "asc" : "desc") as SortDir };
			writeProjectSort(next);
			return next;
		});
	}, []);

	const sortColumn = (field: ProjectSortField): Partial<TableColumn> => ({
		sortable: true,
		sortDirection: projectSort.field === field ? projectSort.direction : null,
		onSort: () => handleProjectSort(field),
	});

	const tableColumns: TableColumn[] = [
		{ key: "number", label: "", width: "30px" },
		{ key: "name", label: "NAME", width: "minmax(100px, 2fr)", ...sortColumn("name") },
		{ key: "alias", label: "ALIAS", width: "minmax(80px, 1fr)", ...sortColumn("alias") },
		{ key: "type", label: "TYPE", width: "minmax(80px, 0.8fr)" },
		{
			key: "entryCount",
			label: "ENTRIES",
			width: "minmax(60px, 0.5fr)",
			align: "right",
			...sortColumn("entryCount"),
		},
		{
			key: "lastEntry",
			label: "LAST ENTRY",
			width: "minmax(120px, 1.2fr)",
			...sortColumn("lastEntry"),
		},
		{ key: "status", label: "STATUS", width: "minmax(5rem, 0.8fr)" },
		{ key: "actions", label: "", width: "minmax(6rem, auto)", align: "right" },
	];

	const formatTableRows = (
		projects: ExtendedProject[],
		isArchived: boolean,
		actions: RowActions,
	): TableRow[] => {
		return projects.map((project, index) => {
			const target: ProjectActionTarget = { alias: project.alias, name: project.name };
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
				actions: (
					<div className="flex items-center justify-end gap-0.5">
						{isArchived ? (
							<>
								<button
									type="button"
									title="Restore project"
									aria-label={`Restore ${project.name}`}
									className={rowActionButton}
									onClick={(e) => {
										e.stopPropagation();
										actions.onRestore(target);
									}}
								>
									<ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
								</button>
								<button
									type="button"
									title="Delete permanently"
									aria-label={`Delete ${project.name} permanently`}
									className={rowActionButton}
									onClick={(e) => {
										e.stopPropagation();
										actions.onHardDelete(target);
									}}
								>
									<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
								</button>
							</>
						) : (
							<>
								<button
									type="button"
									title="Rename project"
									aria-label={`Rename ${project.name}`}
									className={rowActionButton}
									onClick={(e) => {
										e.stopPropagation();
										actions.onRename(target);
									}}
								>
									<Pencil className="h-3.5 w-3.5" aria-hidden="true" />
								</button>
								<button
									type="button"
									title="Archive project"
									aria-label={`Archive ${project.name}`}
									className={rowActionButton}
									onClick={(e) => {
										e.stopPropagation();
										actions.onArchive(target);
									}}
								>
									<Archive className="h-3.5 w-3.5" aria-hidden="true" />
								</button>
								<button
									type="button"
									title="Delete project"
									aria-label={`Delete ${project.name}`}
									className={rowActionButton}
									onClick={(e) => {
										e.stopPropagation();
										actions.onDelete(target);
									}}
								>
									<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
								</button>
							</>
						)}
					</div>
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
						message = `This will archive project "${projectName}". You can restore it later.`;
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
							message = `This will archive project "${projectName}" and all of its documents. You can restore the project from the archived view; its documents stay archived and can be restored individually.`;
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

	const rowActions = useMemo<RowActions>(
		() => ({
			onRename: (target) => setRenameTarget(target),
			onArchive: (target) => void executeProjectCommand(`archive ${target.alias}`),
			onRestore: (target) => void executeProjectCommand(`unarchive ${target.alias}`),
			onDelete: (target) => void executeProjectCommand(`delete ${target.alias}`),
			onHardDelete: (target) => void executeProjectCommand(`delete ${target.alias} --hard`),
		}),
		[executeProjectCommand],
	);

	const handleRenameSubmit = useCallback(
		(newName: string) => {
			if (renameTarget) {
				void executeProjectCommand(`rename ${renameTarget.alias} ${newName}`);
			}
			setRenameTarget(null);
		},
		[renameTarget, executeProjectCommand],
	);

	// Let the command palette open the New / Rename dialogs after navigating here.
	// The request is only consumed once resolved (or loading has finished and the
	// project is confirmed absent), so it isn't lost if projects are still loading
	// when we arrive from the palette.
	const pendingManageRequest = useProjectManageStore((s) => s.request);
	const consumeManageRequest = useProjectManageStore((s) => s.consume);
	useEffect(() => {
		if (!pendingManageRequest) return;
		if (pendingManageRequest.type === "new") {
			consumeManageRequest();
			setIsNewProjectDialogOpen(true);
			return;
		}
		const proj = projects.find((p) => p.id === pendingManageRequest.projectId);
		if (proj) {
			consumeManageRequest();
			setRenameTarget({ alias: proj.alias, name: proj.name });
		} else if (!isLoading) {
			consumeManageRequest();
		}
	}, [pendingManageRequest, consumeManageRequest, projects, isLoading]);

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

	const { shortcuts } = useMergedConfig();
	const pShortcuts = shortcuts.projects;

	const projectHotkeys = useMemo(
		() => [
			{
				...pShortcuts.newProject,
				handler: () => setIsNewProjectDialogOpen(true),
				allowInInput: false,
			},
			{ ...pShortcuts.selectNext, handler: selectNext, allowInInput: false },
			{ ...pShortcuts.selectPrev, handler: selectPrevious, allowInInput: false },
			{ ...pShortcuts.arrowDown, handler: selectNext, allowInInput: false },
			{ ...pShortcuts.arrowUp, handler: selectPrevious, allowInInput: false },
			{
				...pShortcuts.switchToSelected,
				handler: selectCurrentProject,
				allowInInput: false,
			},
			...(pShortcuts.archive.key
				? [
						{
							...pShortcuts.archive,
							handler: () => {
								const selected = projectsRef.current.find((p) => p.id === selectedProjectIdRef.current);
								if (selected) {
									void executeProjectCommand(`archive ${selected.alias}`);
								}
							},
							allowInInput: false,
						},
					]
				: []),
			{
				...pShortcuts.restore,
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
				...pShortcuts.delete,
				handler: () => {
					const selected = projectsRef.current.find((p) => p.id === selectedProjectIdRef.current);
					if (selected) {
						void executeProjectCommand(`delete ${selected.alias}`);
					}
				},
				allowInInput: false,
			},
			{
				...pShortcuts.permanentDelete,
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
		[selectNext, selectPrevious, selectCurrentProject, executeProjectCommand, pShortcuts],
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
					<div className="mb-4 flex items-center justify-between gap-3">
						<div className="text-xs font-semibold tracking-wider uppercase text-text-dim">
							ACTIVE PROJECTS
						</div>
						<button
							type="button"
							onClick={() => setIsNewProjectDialogOpen(true)}
							className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-dim transition-colors hover:border-accent hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<Plus className="h-3.5 w-3.5" aria-hidden="true" />
							New project
						</button>
					</div>

					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-text-dim">Loading projects...</div>
						</div>
					) : activeProjectDetails.length === 0 && archivedProjectDetails.length === 0 ? (
						<EmptyState
							icon={<FolderPlus className="h-6 w-6" aria-hidden="true" />}
							title="No projects yet"
							description="Create your first project to organize documents, tags, and search."
							actionLabel="Create project"
							onAction={() => setIsNewProjectDialogOpen(true)}
						/>
					) : (
						<Table
							columns={tableColumns}
							rows={formatTableRows(activeProjectDetails, false, rowActions)}
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
								rows={formatTableRows(archivedProjectDetails, true, rowActions)}
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
			<RenameProjectDialog
				isOpen={renameTarget !== null}
				currentName={renameTarget?.name ?? ""}
				onClose={() => setRenameTarget(null)}
				onSubmit={handleRenameSubmit}
			/>
		</>
	);
};

export const Projects = React.memo(ProjectsComponent);

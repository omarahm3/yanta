import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { ListDates } from "../../../bindings/yanta/internal/journal/wailsservice";
import { ListActive } from "../../../bindings/yanta/internal/project/service";
import { cn } from "../../lib/utils";
import { DatePicker } from "./DatePicker";
import { JournalEntry, type JournalEntryData } from "./JournalEntry";
import { useJournal } from "./useJournal";

export interface JournalProps {
	projectAlias: string;
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
	className?: string;
}

interface Project {
	id: string;
	alias: string;
	name: string;
}

/**
 * Journal Browser UI
 * Based on PRD Section 7.9 - Journal Entry Operations
 */
export const Journal: React.FC<JournalProps> = ({
	projectAlias,
	onNavigate,
	className,
}) => {
	const [isSelectionMode, setIsSelectionMode] = useState(false);
	const [showPromoteDialog, setShowPromoteDialog] = useState(false);
	const [datesWithEntries, setDatesWithEntries] = useState<string[]>([]);
	const [projects, setProjects] = useState<Project[]>([]);
	const [targetProject, setTargetProject] = useState(projectAlias);
	const [promoteTitle, setPromoteTitle] = useState("");
	const [keepOriginal, setKeepOriginal] = useState(false);

	const {
		entries,
		isLoading,
		error,
		isEmpty,
		selectedIds,
		date,
		setDate,
		deleteEntry,
		promoteToDocument,
		toggleSelection,
		clearSelection,
	} = useJournal({ projectAlias });

	// Load dates with entries for calendar highlighting
	useEffect(() => {
		const loadDates = async () => {
			try {
				const dates = await ListDates(projectAlias, 0, 0);
				setDatesWithEntries(dates as string[]);
			} catch (err) {
				console.error("Failed to load dates:", err);
			}
		};
		loadDates();
	}, [projectAlias]);

	// Load projects for promote dialog
	useEffect(() => {
		const loadProjects = async () => {
			try {
				const result = await ListActive();
				const mapped = result
					.filter((p): p is NonNullable<typeof p> => p !== null)
					.map((p) => ({ id: p.id, alias: p.alias, name: p.name }));
				setProjects(mapped);
			} catch (err) {
				console.error("Failed to load projects:", err);
			}
		};
		loadProjects();
	}, []);

	const handleDelete = useCallback(
		async (id: string) => {
			try {
				await deleteEntry(id);
				// TODO: Show undo toast
			} catch (err) {
				console.error("Failed to delete entry:", err);
			}
		},
		[deleteEntry]
	);

	const handleEdit = useCallback(
		(entry: JournalEntryData) => {
			// TODO: Implement inline edit
			console.log("Edit entry:", entry);
		},
		[]
	);

	const handleToggleSelection = useCallback(
		(id: string, selected: boolean) => {
			toggleSelection(id);
		},
		[toggleSelection]
	);

	const handlePromote = useCallback(async () => {
		if (selectedIds.size === 0) return;

		try {
			const documentPath = await promoteToDocument({
				entryIds: Array.from(selectedIds),
				targetProject,
				title: promoteTitle || "Untitled",
				keepOriginal,
			});

			setShowPromoteDialog(false);
			setIsSelectionMode(false);
			clearSelection();
			setPromoteTitle("");

			// Navigate to the new document
			if (onNavigate) {
				onNavigate("document", { documentPath });
			}
		} catch (err) {
			console.error("Failed to promote to document:", err);
		}
	}, [
		selectedIds,
		promoteToDocument,
		targetProject,
		promoteTitle,
		keepOriginal,
		clearSelection,
		onNavigate,
	]);

	const toggleSelectionMode = useCallback(() => {
		setIsSelectionMode((prev) => !prev);
		if (isSelectionMode) {
			clearSelection();
		}
	}, [isSelectionMode, clearSelection]);

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b border-border">
				<h1 className="text-lg font-semibold">Journal</h1>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={toggleSelectionMode}
						className={cn(
							"px-3 py-1.5 text-sm rounded transition-colors",
							isSelectionMode
								? "bg-accent text-white"
								: "bg-surface border border-border hover:border-accent"
						)}
					>
						{isSelectionMode ? "Cancel" : "Select"}
					</button>
					{isSelectionMode && selectedIds.size > 0 && (
						<button
							type="button"
							onClick={() => setShowPromoteDialog(true)}
							className="px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent/90"
						>
							Promote ({selectedIds.size})
						</button>
					)}
				</div>
			</div>

			{/* Date picker */}
			<div className="p-4 border-b border-border">
				<DatePicker
					selectedDate={date}
					onDateChange={setDate}
					datesWithEntries={datesWithEntries}
				/>
			</div>

			{/* Entry list */}
			<div className="flex-1 overflow-y-auto p-4">
				{isLoading && (
					<div className="text-center text-text-secondary py-8">Loading...</div>
				)}

				{error && (
					<div className="text-center text-[#E06C75] py-8">{error}</div>
				)}

				{isEmpty && !isLoading && (
					<div className="text-center text-text-secondary py-8">
						<p>No entries for this day.</p>
						<p className="mt-2 text-sm">
							Press your quick capture hotkey to add one!
						</p>
					</div>
				)}

				{!isLoading && !isEmpty && (
					<div className="space-y-3">
						{entries.map((entry) => (
							<JournalEntry
								key={entry.id}
								entry={entry}
								onDelete={handleDelete}
								onEdit={handleEdit}
								onSelect={handleToggleSelection}
								isSelected={selectedIds.has(entry.id)}
								showCheckbox={isSelectionMode}
							/>
						))}
					</div>
				)}
			</div>

			{/* Promote Dialog */}
			{showPromoteDialog && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-surface border border-border rounded-lg p-6 w-full max-w-md">
						<h2 className="text-lg font-semibold mb-4">Move to Document</h2>

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-1">Title</label>
								<input
									type="text"
									value={promoteTitle}
									onChange={(e) => setPromoteTitle(e.target.value)}
									placeholder="Document title"
									className="w-full px-3 py-2 bg-surface border border-border rounded focus:outline-none focus:border-accent"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-1">
									Target Project
								</label>
								<select
									value={targetProject}
									onChange={(e) => setTargetProject(e.target.value)}
									className="w-full px-3 py-2 bg-surface border border-border rounded focus:outline-none focus:border-accent"
								>
									{projects.map((p) => (
										<option key={p.id} value={p.alias}>
											@{p.alias}
										</option>
									))}
								</select>
							</div>

							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="keepOriginal"
									checked={keepOriginal}
									onChange={(e) => setKeepOriginal(e.target.checked)}
									className="rounded border-border"
								/>
								<label htmlFor="keepOriginal" className="text-sm">
									Keep original entries (copy instead of move)
								</label>
							</div>
						</div>

						<div className="flex justify-end gap-3 mt-6">
							<button
								type="button"
								onClick={() => setShowPromoteDialog(false)}
								className="px-4 py-2 text-sm border border-border rounded hover:border-accent"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handlePromote}
								className="px-4 py-2 text-sm bg-accent text-white rounded hover:bg-accent/90"
							>
								{keepOriginal ? "Copy" : "Move"} to Document
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

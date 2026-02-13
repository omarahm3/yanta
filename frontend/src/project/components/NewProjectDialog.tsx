import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMergedConfig } from "../../config";
import { Modal } from "../../shared/ui/Modal";

export interface NewProjectDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: { name: string; alias: string; startDate: string; endDate: string }) => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
	isOpen,
	onClose,
	onSubmit,
}) => {
	const [name, setName] = useState("");
	const [alias, setAlias] = useState("");
	const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
	const [endDate, setEndDate] = useState("");
	const [errors, setErrors] = useState<{ name?: string; alias?: string }>({});
	const nameInputRef = useRef<HTMLInputElement>(null);
	const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { timeouts } = useMergedConfig();

	useEffect(() => {
		if (focusTimeoutRef.current !== null) {
			clearTimeout(focusTimeoutRef.current);
			focusTimeoutRef.current = null;
		}

		if (isOpen) {
			setName("");
			setAlias("");
			setStartDate(new Date().toISOString().split("T")[0]);
			setEndDate("");
			setErrors({});
			focusTimeoutRef.current = setTimeout(() => {
				nameInputRef.current?.focus();
				focusTimeoutRef.current = null;
			}, timeouts.focusRestoreMs);
		}

		return () => {
			if (focusTimeoutRef.current !== null) {
				clearTimeout(focusTimeoutRef.current);
				focusTimeoutRef.current = null;
			}
		};
	}, [isOpen, timeouts.focusRestoreMs]);

	const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setName(value);

		// Auto-generate alias from name if alias is empty or was auto-generated
		const suggestedAlias = `@${value
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")}`;
		setAlias((prev) => {
			// Only auto-update if alias is empty or matches the pattern of auto-generated
			if (!prev || prev.startsWith("@")) {
				return suggestedAlias;
			}
			return prev;
		});
	}, []);

	const handleAliasChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		let value = e.target.value;
		// Ensure alias starts with @
		if (!value.startsWith("@")) {
			value = `@${value}`;
		}
		// Only allow valid alias characters
		value = value.replace(/[^@a-zA-Z0-9_-]/g, "");
		setAlias(value);
	}, []);

	const validate = useCallback(() => {
		const newErrors: { name?: string; alias?: string } = {};

		if (!name.trim()) {
			newErrors.name = "Project name is required";
		}

		if (!alias || alias === "@") {
			newErrors.alias = "Project alias is required";
		} else if (!/^@[a-zA-Z0-9_-]+$/.test(alias)) {
			newErrors.alias =
				"Alias must start with @ and contain only letters, numbers, hyphens, or underscores";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}, [name, alias]);

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			if (validate()) {
				onSubmit({
					name: name.trim(),
					alias: alias.trim(),
					startDate,
					endDate,
				});
			}
		},
		[name, alias, startDate, endDate, validate, onSubmit],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		},
		[onClose],
	);

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="New Project" size="md">
			<form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
				<div>
					<label htmlFor="project-name" className="block text-sm font-medium text-text mb-1">
						Name <span className="text-red">*</span>
					</label>
					<input
						ref={nameInputRef}
						id="project-name"
						type="text"
						value={name}
						onChange={handleNameChange}
						placeholder="My Project"
						className="w-full px-3 py-2 bg-glass-bg/20 backdrop-blur-sm border border-glass-border rounded-md text-text placeholder-text-dim focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
					/>
					{errors.name && <p className="mt-1 text-sm text-red">{errors.name}</p>}
				</div>

				<div>
					<label htmlFor="project-alias" className="block text-sm font-medium text-text mb-1">
						Alias <span className="text-red">*</span>
					</label>
					<input
						id="project-alias"
						type="text"
						value={alias}
						onChange={handleAliasChange}
						placeholder="@my-project"
						className="w-full px-3 py-2 bg-glass-bg/20 backdrop-blur-sm border border-glass-border rounded-md text-text placeholder-text-dim focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono"
					/>
					{errors.alias && <p className="mt-1 text-sm text-red">{errors.alias}</p>}
					<p className="mt-1 text-xs text-text-dim">
						Used to reference this project (e.g., @work, @personal)
					</p>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="project-start-date" className="block text-sm font-medium text-text mb-1">
							Start Date
						</label>
						<input
							id="project-start-date"
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="w-full px-3 py-2 bg-glass-bg/20 backdrop-blur-sm border border-glass-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
						/>
					</div>

					<div>
						<label htmlFor="project-end-date" className="block text-sm font-medium text-text mb-1">
							End Date <span className="text-text-dim">(optional)</span>
						</label>
						<input
							id="project-end-date"
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className="w-full px-3 py-2 bg-glass-bg/20 backdrop-blur-sm border border-glass-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
						/>
					</div>
				</div>

				<div className="flex justify-end gap-3 pt-4">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 text-sm font-medium text-text-dim hover:text-text bg-glass-bg/20 backdrop-blur-sm border border-glass-border rounded-md hover:bg-glass-bg/40 transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-md transition-colors"
					>
						Create Project
					</button>
				</div>
			</form>
		</Modal>
	);
};

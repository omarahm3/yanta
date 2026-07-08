import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import { Modal } from "../../shared/ui/Modal";

export interface RenameProjectDialogProps {
	isOpen: boolean;
	/** Current project name, used to seed the field. */
	currentName: string;
	onClose: () => void;
	onSubmit: (name: string) => void;
}

export const RenameProjectDialog: React.FC<RenameProjectDialogProps> = ({
	isOpen,
	currentName,
	onClose,
	onSubmit,
}) => {
	const [name, setName] = useState(currentName);
	const [error, setError] = useState<string | undefined>();
	const nameInputRef = useRef<HTMLInputElement>(null);
	const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { timeouts } = useMergedConfig();

	useEffect(() => {
		if (focusTimeoutRef.current !== null) {
			clearTimeout(focusTimeoutRef.current);
			focusTimeoutRef.current = null;
		}

		if (isOpen) {
			setName(currentName);
			setError(undefined);
			focusTimeoutRef.current = setTimeout(() => {
				nameInputRef.current?.focus();
				nameInputRef.current?.select();
				focusTimeoutRef.current = null;
			}, timeouts.focusRestoreMs);
		}

		return () => {
			if (focusTimeoutRef.current !== null) {
				clearTimeout(focusTimeoutRef.current);
				focusTimeoutRef.current = null;
			}
		};
	}, [isOpen, currentName, timeouts.focusRestoreMs]);

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			const trimmed = name.trim();
			if (!trimmed) {
				setError("Project name is required");
				return;
			}
			if (trimmed === currentName) {
				onClose();
				return;
			}
			onSubmit(trimmed);
		},
		[name, currentName, onSubmit, onClose],
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
		<Modal isOpen={isOpen} onClose={onClose} title="Rename Project" size="md">
			<form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
				<div>
					<label htmlFor="rename-project-name" className="block text-sm font-medium text-text mb-1">
						Name <span className="text-red">*</span>
					</label>
					<input
						ref={nameInputRef}
						id="rename-project-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="My Project"
						className="w-full px-3 py-2 bg-glass-bg/20 backdrop-blur-sm border border-glass-border rounded-md text-text placeholder-text-dim focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
					/>
					{error && <p className="mt-1 text-sm text-red">{error}</p>}
					<p className="mt-1 text-xs text-text-dim">
						The alias stays the same; only the display name changes.
					</p>
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
						Rename
					</button>
				</div>
			</form>
		</Modal>
	);
};

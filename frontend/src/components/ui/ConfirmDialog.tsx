import React from "react";
import { useDialog } from "../../contexts/DialogContext";
import { cn } from "../../lib/utils";

export interface ConfirmDialogProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel: () => void;
	danger?: boolean;
	inputPrompt?: string;
	expectedInput?: string;
	showCheckbox?: boolean;
	checkboxLabel?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
	isOpen,
	title,
	message,
	confirmText = "Confirm",
	cancelText = "Cancel",
	onConfirm,
	onCancel,
	danger = false,
	inputPrompt,
	expectedInput,
	showCheckbox = false,
	checkboxLabel = "I understand this action cannot be undone",
}) => {
	const { openDialog, closeDialog } = useDialog();
	const [inputValue, setInputValue] = React.useState("");
	const [isChecked, setIsChecked] = React.useState(false);
	const dialogRef = React.useRef<HTMLDivElement>(null);
	const cancelButtonRef = React.useRef<HTMLButtonElement>(null);
	const confirmButtonRef = React.useRef<HTMLButtonElement>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const checkboxRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		if (isOpen) {
			setInputValue("");
			setIsChecked(false);
			openDialog();
		} else {
			closeDialog();
		}
	}, [isOpen, openDialog, closeDialog]);

	React.useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				onCancel();
				return;
			}

			if (event.key === "Tab") {
				const container = dialogRef.current;
				if (!container) return;
				if (!container.contains(event.target as Node)) {
					cancelButtonRef.current?.focus();
				}

				const focusableElements: HTMLElement[] = [];
				if (cancelButtonRef.current) {
					focusableElements.push(cancelButtonRef.current);
				}
				if (confirmButtonRef.current && !confirmButtonRef.current.disabled) {
					focusableElements.push(confirmButtonRef.current);
				}
				if (inputRef.current) {
					focusableElements.push(inputRef.current);
				}
				if (checkboxRef.current) {
					focusableElements.push(checkboxRef.current);
				}

				if (focusableElements.length === 0) {
					return;
				}

				event.preventDefault();
				const target = event.target as HTMLElement;
				const currentIndex = focusableElements.indexOf(target);

				if (currentIndex === -1) {
					const targetIndex = event.shiftKey ? focusableElements.length - 1 : 0;
					focusableElements[targetIndex]?.focus();
					return;
				}

				const direction = event.shiftKey ? -1 : 1;
				let nextIndex = currentIndex + direction;
				if (nextIndex < 0) {
					nextIndex = focusableElements.length - 1;
				} else if (nextIndex >= focusableElements.length) {
					nextIndex = 0;
				}
				focusableElements[nextIndex]?.focus();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onCancel]);

	React.useLayoutEffect(() => {
		if (!isOpen) return;

		if (inputRef.current) {
			inputRef.current.focus();
		} else if (checkboxRef.current) {
			checkboxRef.current.focus();
		} else if (cancelButtonRef.current) {
			cancelButtonRef.current.focus();
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const isInputValid = !expectedInput || inputValue === expectedInput;
	const isCheckboxValid = !showCheckbox || isChecked;
	const canConfirm = isInputValid && isCheckboxValid;

	const handleConfirm = () => {
		if (canConfirm) {
			onConfirm();
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
			onClick={onCancel}
			role="presentation"
		>
			<div
				ref={dialogRef}
				className="relative w-full max-w-md mx-4 bg-surface border-2 border-border rounded-lg shadow-2xl"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="confirm-dialog-title"
			>
				<div className="px-6 py-4 border-b border-border">
					<h2 id="confirm-dialog-title" className="text-lg font-bold tracking-wide text-text">
						{title}
					</h2>
				</div>

				<div className="px-6 py-4 space-y-4">
					<p className="text-sm text-text-dim">{message}</p>

					{inputPrompt && expectedInput && (
						<div className="space-y-2">
							<label className="text-sm font-medium text-text">{inputPrompt}</label>
							<input
								type="text"
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								ref={inputRef}
								className="w-full px-3 py-2 text-sm border rounded bg-bg border-border text-text focus:outline-none focus:border-accent"
								placeholder={expectedInput}
							/>
						</div>
					)}

					{showCheckbox && (
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={isChecked}
								onChange={(e) => setIsChecked(e.target.checked)}
								ref={checkboxRef}
								className="w-4 h-4 border rounded cursor-pointer border-border bg-bg accent-accent"
							/>
							<span className="text-sm text-text-dim">{checkboxLabel}</span>
						</label>
					)}
				</div>

				<div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
					<button
						type="button"
						onClick={onCancel}
						ref={cancelButtonRef}
						className="px-4 py-2 text-sm font-medium border rounded transition-colors bg-transparent border-border text-text hover:bg-bg"
					>
						{cancelText}
					</button>
					<button
						type="button"
						onClick={handleConfirm}
						disabled={!canConfirm}
						ref={confirmButtonRef}
						className={cn(
							"px-4 py-2 text-sm font-medium rounded transition-colors",
							danger
								? "bg-red text-bg hover:bg-red/80 border border-red disabled:opacity-50 disabled:cursor-not-allowed"
								: "bg-accent text-bg hover:bg-accent/80 border border-accent disabled:opacity-50 disabled:cursor-not-allowed",
						)}
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
};

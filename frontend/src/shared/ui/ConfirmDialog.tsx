import React from "react";
import { useDialog } from "../stores/dialog.store";
import { cn } from "../utils/cn";
import { Button } from "./Button";
import { Checkbox } from "./checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import { Input } from "./Input";
import { Label } from "./Label";

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
	const cancelButtonRef = React.useRef<HTMLButtonElement>(null);
	const confirmButtonRef = React.useRef<HTMLButtonElement>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);

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
		if (!isOpen || inputPrompt) return;
		const id = requestAnimationFrame(() => {
			const target = danger ? cancelButtonRef.current : confirmButtonRef.current;
			target?.focus();
		});
		return () => cancelAnimationFrame(id);
	}, [isOpen, danger, inputPrompt]);

	const handleOpenAutoFocus = (e: Event) => {
		if (inputPrompt) return;
		e.preventDefault();
		const target = danger ? cancelButtonRef.current : confirmButtonRef.current;
		target?.focus();
	};

	const handleContentKeyDown = (e: React.KeyboardEvent) => {
		if (e.key !== "Enter" || inputPrompt) return;
		// Let focused interactive controls handle Enter themselves — otherwise
		// pressing Enter on Cancel/checkbox would be hijacked by the default action.
		const target = e.target as HTMLElement;
		if (target.closest("button, [role='checkbox'], input, textarea, select")) return;
		e.preventDefault();
		if (danger) {
			onCancel();
		} else {
			handleConfirm();
		}
	};

	const isInputValid = !expectedInput || inputValue === expectedInput;
	const isCheckboxValid = !showCheckbox || isChecked;
	const canConfirm = isInputValid && isCheckboxValid;

	const handleConfirm = () => {
		if (canConfirm) {
			onConfirm();
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onCancel();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="sm:max-w-md"
				showCloseButton={false}
				onKeyDown={handleContentKeyDown}
				onOpenAutoFocus={handleOpenAutoFocus}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<DialogDescription className="text-sm text-text-dim">{message}</DialogDescription>

					{inputPrompt && expectedInput && (
						<div className="space-y-2">
							<Label>{inputPrompt}</Label>
							<Input
								type="text"
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								ref={inputRef}
								placeholder={expectedInput}
								autoFocus
							/>
						</div>
					)}

					{showCheckbox && (
						<div className="flex items-center gap-3">
							<Checkbox
								id="confirm-checkbox"
								checked={isChecked}
								onCheckedChange={(checked) => setIsChecked(checked === true)}
							/>
							<Label
								htmlFor="confirm-checkbox"
								className={cn("cursor-pointer text-sm font-normal text-muted-foreground")}
							>
								{checkboxLabel}
							</Label>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="secondary" onClick={onCancel} ref={cancelButtonRef}>
						{cancelText}
					</Button>
					<Button
						variant={canConfirm && danger ? "destructive" : canConfirm ? "primary" : "secondary"}
						onClick={handleConfirm}
						disabled={!canConfirm}
						ref={confirmButtonRef}
						className={cn(!canConfirm && "opacity-50 cursor-not-allowed")}
					>
						{confirmText}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

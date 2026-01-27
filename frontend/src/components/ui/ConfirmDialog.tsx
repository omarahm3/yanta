import React from "react";
import { useDialog } from "../../contexts/DialogContext";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { Checkbox } from "./checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./Input";
import { Label } from "./Label";
import { Text } from "./Text";

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
			<DialogContent className="sm:max-w-md" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<Text size="sm" variant="dim">
						{message}
					</Text>

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
						variant={danger ? "destructive" : "primary"}
						onClick={handleConfirm}
						disabled={!canConfirm}
						ref={confirmButtonRef}
					>
						{confirmText}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

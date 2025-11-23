import { Dialog, Switch, Transition } from "@headlessui/react";
import React, { Fragment } from "react";
import { useDialog } from "../../contexts/DialogContext";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
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

	return (
		<Transition appear show={isOpen} as={Fragment}>
			<Dialog as="div" className="relative z-50" onClose={onCancel}>
				<Transition.Child
					as={Fragment}
					enter="ease-out duration-300"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="ease-in duration-200"
					leaveFrom="opacity-100"
					leaveTo="opacity-0"
				>
					<div className="fixed inset-0 bg-black/70" />
				</Transition.Child>

				<div className="fixed inset-0 overflow-y-auto">
					<div className="flex min-h-full items-center justify-center p-4 text-center">
						<Transition.Child
							as={Fragment}
							enter="ease-out duration-300"
							enterFrom="opacity-0 scale-95"
							enterTo="opacity-100 scale-100"
							leave="ease-in duration-200"
							leaveFrom="opacity-100 scale-100"
							leaveTo="opacity-0 scale-95"
						>
							<Dialog.Panel className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-surface border-2 border-border shadow-2xl transition-all text-left">
								<div className="px-6 py-4 border-b border-border">
									<Dialog.Title as="h2" className="text-lg font-bold tracking-wide text-text">
										{title}
									</Dialog.Title>
								</div>

								<div className="px-6 py-4 space-y-4">
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
											<Switch
												checked={isChecked}
												onChange={setIsChecked}
												className={cn(
													"relative inline-flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
													isChecked
														? "bg-accent border-accent"
														: "bg-transparent border-border hover:border-accent",
												)}
											>
												<span className="sr-only">{checkboxLabel}</span>
												{isChecked && <span className="text-bg text-xs font-bold">✓</span>}
											</Switch>
											<Label className="cursor-pointer text-sm font-normal text-text-dim">
												{checkboxLabel}
											</Label>
										</div>
									)}
								</div>

								<div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
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
								</div>
							</Dialog.Panel>
						</Transition.Child>
					</div>
				</div>
			</Dialog>
		</Transition>
	);
};

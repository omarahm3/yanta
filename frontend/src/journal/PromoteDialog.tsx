import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useProjectContext } from "../project";
import { Button } from "../shared/ui/Button";
import { Checkbox } from "../shared/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../shared/ui/dialog";
import { Input } from "../shared/ui/Input";
import { Label } from "../shared/ui/Label";
import { Select, type SelectOption } from "../shared/ui/Select";
import type { PromoteDialogState } from "./useJournalDialogs";

interface PromoteDialogProps {
	dialog: PromoteDialogState;
	onClose: () => void;
	onConfirm: () => void;
	onChange: (updates: Partial<PromoteDialogState>) => void;
}

export const PromoteDialog: React.FC<PromoteDialogProps> = ({
	dialog,
	onClose,
	onConfirm,
	onChange,
}) => {
	const { projects } = useProjectContext();
	const titleRef = useRef<HTMLInputElement>(null);

	const projectOptions: SelectOption[] = useMemo(
		() => projects.map((p) => ({ value: p.alias, label: `${p.name} (${p.alias})` })),
		[projects],
	);

	useEffect(() => {
		if (dialog.isOpen) {
			setTimeout(() => titleRef.current?.focus(), 50);
		}
	}, [dialog.isOpen]);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) onClose();
		},
		[onClose],
	);

	return (
		<Dialog open={dialog.isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Promote to Document</DialogTitle>
					<DialogDescription>Create a document from the selected journal entries.</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="promote-title">Document title</Label>
						<Input
							id="promote-title"
							ref={titleRef}
							type="text"
							value={dialog.title}
							onChange={(e) => onChange({ title: e.target.value })}
							placeholder="Journal Notes"
						/>
					</div>

					<div className="space-y-2">
						<Label>Target project</Label>
						<Select
							value={dialog.targetProject}
							onChange={(value) => onChange({ targetProject: value })}
							options={projectOptions}
						/>
					</div>

					<div className="flex items-center gap-3">
						<Checkbox
							id="keep-original"
							checked={dialog.keepOriginal}
							onCheckedChange={(checked) => onChange({ keepOriginal: checked === true })}
						/>
						<Label htmlFor="keep-original" className="cursor-pointer text-sm font-normal">
							Keep original journal entries
						</Label>
					</div>
				</div>

				<DialogFooter>
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="primary" onClick={onConfirm}>
						Promote
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

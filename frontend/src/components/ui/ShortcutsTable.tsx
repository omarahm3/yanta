import type React from "react";
import { cn } from "../../lib/utils";
import { KeyDisplay } from "./KeyDisplay";

export interface Shortcut {
	id: string;
	action: string;
	defaultKey: string;
	currentKey: string;
	editable?: boolean;
}

export interface ShortcutsTableProps {
	shortcuts: Shortcut[];
	onShortcutChange?: (id: string, newKey: string) => void;
	onReset?: () => void;
	className?: string;
}

export const ShortcutsTable: React.FC<ShortcutsTableProps> = ({ shortcuts, className }) => {
	return (
		<div className={cn("w-full text-sm", className)}>
			{/* Header */}
			<div className="grid grid-cols-[1fr_200px] gap-4 pb-3 mb-3 border-b border-border">
				<div className="text-text-dim text-xs uppercase tracking-wider font-medium">ACTION</div>
				<div className="text-text-dim text-xs uppercase tracking-wider font-medium">SHORTCUT</div>
			</div>

			{/* Rows */}
			<div className="space-y-0.5">
				{shortcuts.map((shortcut) => (
					<div key={shortcut.id} className="grid grid-cols-[1fr_200px] gap-4 py-2 items-center">
						<div className="text-text">{shortcut.action}</div>
						<div>
							<KeyDisplay keys={[shortcut.currentKey]} />
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

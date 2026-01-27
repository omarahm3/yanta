import type React from "react";
import { cn } from "../../lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

export interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	children: React.ReactNode;
	title?: string;
	size?: "sm" | "md" | "lg" | "xl";
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, size = "md" }) => {
	const sizeClasses = {
		sm: "sm:max-w-sm",
		md: "sm:max-w-md",
		lg: "sm:max-w-lg",
		xl: "sm:max-w-xl",
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className={cn(sizeClasses[size])}>
				{title && (
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
				)}
				{children}
			</DialogContent>
		</Dialog>
	);
};

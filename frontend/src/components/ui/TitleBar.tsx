import { System, Window } from "@wailsio/runtime";
import type React from "react";
import { useEffect, useState } from "react";
import { RiCheckboxBlankLine, RiCloseLine, RiSubtractLine } from "react-icons/ri";
import { BackgroundQuit } from "../../../bindings/yanta/internal/system/service";
import { IsFrameless } from "../../../bindings/yanta/internal/window/service";
import { useTitleBarContext } from "../../contexts";
import { Button } from "./Button";

export const TitleBar: React.FC = () => {
	const [shouldShow, setShouldShow] = useState<boolean>(false);
	const { setHeight } = useTitleBarContext();

	useEffect(() => {
		const checkFrameless = async () => {
			const isLinux = System.IsLinux();
			if (!isLinux) {
				setShouldShow(false);
				setHeight(0);
				return;
			}

			try {
				const frameless = await IsFrameless();
				setShouldShow(frameless);
				setHeight(frameless ? 2 : 0);
			} catch (err) {
				console.error("Failed to check frameless mode:", err);
				setShouldShow(false);
				setHeight(0);
			}
		};

		checkFrameless();
	}, [setHeight]);

	const handleMinimize = () => {
		Window.Minimise();
	};

	const handleMaximize = () => {
		Window.ToggleMaximise();
	};

	const handleClose = () => {
		BackgroundQuit();
	};

	if (!shouldShow) {
		return null;
	}

	return (
		<div
			className="flex items-center justify-between h-8 px-3 bg-surface border-b border-border"
			style={{ "--wails-draggable": "drag" } as React.CSSProperties}
		>
			<div className="flex items-center gap-2"></div>

			<div
				className="flex items-center gap-1"
				style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
			>
				<Button
					variant="ghost"
					size="sm"
					onClick={handleMinimize}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-border hover:text-text p-0"
					title="Minimize"
				>
					<RiSubtractLine className="text-sm" />
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={handleMaximize}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-border hover:text-text p-0"
					title="Maximize"
				>
					<RiCheckboxBlankLine className="text-sm" />
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={handleClose}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-red hover:text-bg p-0"
					title="Close"
				>
					<RiCloseLine className="text-sm" />
				</Button>
			</div>
		</div>
	);
};

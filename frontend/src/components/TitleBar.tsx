import { System, Window } from "@wailsio/runtime";
import type React from "react";
import { useEffect, useState } from "react";
import { RiCheckboxBlankLine, RiCloseLine, RiSubtractLine } from "react-icons/ri";
import { BackgroundQuit } from "../../bindings/yanta/internal/system/service";
import { useTitleBarContext } from "../contexts";

export const TitleBar: React.FC = () => {
	const [isLinux, setIsLinux] = useState<boolean | null>(null);
	const { setHeight } = useTitleBarContext();

	useEffect(() => {
		const linux = System.IsLinux();
		setIsLinux(linux);
		setHeight(linux ? 2 : 0);
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

	if (isLinux !== true) {
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
				<button
					type="button"
					onClick={handleMinimize}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-border hover:text-text"
					title="Minimize"
				>
					<RiSubtractLine className="text-sm" />
				</button>

				<button
					type="button"
					onClick={handleMaximize}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-border hover:text-text"
					title="Maximize"
				>
					<RiCheckboxBlankLine className="text-sm" />
				</button>

				<button
					type="button"
					onClick={handleClose}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-red hover:text-bg"
					title="Close"
				>
					<RiCloseLine className="text-sm" />
				</button>
			</div>
		</div>
	);
};

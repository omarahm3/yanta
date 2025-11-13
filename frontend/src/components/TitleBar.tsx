import type React from "react";
import { useEffect, useState } from "react";
import {
	Environment,
	Quit,
	WindowMinimise,
	WindowToggleMaximise,
} from "../../wailsjs/runtime/runtime";
import { RiSubtractLine, RiCheckboxBlankLine, RiCloseLine } from "react-icons/ri";
import { useTitleBarContext } from "../contexts";

export const TitleBar: React.FC = () => {
	const [isLinux, setIsLinux] = useState(true);
	const { setHeight } = useTitleBarContext();

	useEffect(() => {
		Environment().then((env) => {
			const linux = env.platform === "linux";
			setIsLinux(linux);
			setHeight(linux ? 2 : 0);
		});
	}, [setHeight]);

	const handleMinimize = () => {
		WindowMinimise();
	};

	const handleMaximize = () => {
		WindowToggleMaximise();
	};

	const handleClose = () => {
		Quit();
	};

	if (!isLinux) {
		return null;
	}

	return (
		<div
			className="flex items-center justify-between h-8 px-3 bg-surface border-b border-border"
			style={{ "--wails-draggable": "drag" } as React.CSSProperties}
		>
			{/* App Title */}
			<div className="flex items-center gap-2"></div>

			{/* Window Controls */}
			<div
				className="flex items-center gap-1"
				style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
			>
				<button
					onClick={handleMinimize}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-border hover:text-text"
					title="Minimize"
				>
					<RiSubtractLine className="text-sm" />
				</button>

				<button
					onClick={handleMaximize}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-border hover:text-text"
					title="Maximize"
				>
					<RiCheckboxBlankLine className="text-sm" />
				</button>

				<button
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

import type React from "react";
import { Quit, WindowMinimise, WindowToggleMaximise } from "../../wailsjs/runtime/runtime";

export const TitleBar: React.FC = () => {
	const handleMinimize = () => {
		WindowMinimise();
	};

	const handleMaximize = () => {
		WindowToggleMaximise();
	};

	const handleClose = () => {
		Quit();
	};

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
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
				</button>

				<button
					onClick={handleMaximize}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-border hover:text-text"
					title="Maximize"
				>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
						<rect
							x="2.5"
							y="2.5"
							width="7"
							height="7"
							stroke="currentColor"
							strokeWidth="1.5"
							fill="none"
						/>
					</svg>
				</button>

				<button
					onClick={handleClose}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-red hover:text-bg"
					title="Close"
				>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path
							d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
					</svg>
				</button>
			</div>
		</div>
	);
};

import { System, Window } from "@wailsio/runtime";
import { Minus, Square, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { BackgroundQuit } from "../../../bindings/yanta/internal/system/service";
import { IsFrameless } from "../../../bindings/yanta/internal/window/service";
import { useTitleBarContext } from "../../contexts";
import { BackendLogger } from "../../utils/backendLogger";
import { Button } from "./Button";
import { useToast } from "./Toast";

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
				BackendLogger.error("Failed to check frameless mode:", err);
				setShouldShow(false);
				setHeight(0);
			}
		};

		checkFrameless();
	}, [setHeight]);

	const toast = useToast();

	const handleMinimize = () => {
		try {
			Window.Minimise();
		} catch (err) {
			toast.error("Could not minimize window");
		}
	};

	const handleMaximize = () => {
		try {
			Window.ToggleMaximise();
		} catch (err) {
			toast.error("Could not maximize window");
		}
	};

	const handleClose = () => {
		BackgroundQuit();
	};

	if (!shouldShow) {
		return null;
	}

	return (
		<div
			className="flex items-center justify-between h-8 px-3 bg-glass-bg/40 backdrop-blur-md border-b border-glass-border"
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
					<Minus className="text-sm" />
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={handleMaximize}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-border hover:text-text p-0"
					title="Maximize"
				>
					<Square className="text-sm" />
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={handleClose}
					className="flex items-center justify-center w-8 h-6 text-text-dim transition-colors rounded hover:bg-red hover:text-bg p-0"
					title="Close"
				>
					<X className="text-sm" />
				</Button>
			</div>
		</div>
	);
};

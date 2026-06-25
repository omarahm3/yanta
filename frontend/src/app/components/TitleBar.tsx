import { System, Window } from "@wailsio/runtime";
import { Minus, Square, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { BackgroundQuit } from "../../../bindings/yanta/internal/system/service";
import { IsFrameless } from "../../../bindings/yanta/internal/window/service";
import logoImage from "../../assets/images/logo-universal.png";
import { cn } from "../../shared/utils/cn";
import { useTitleBarContext } from "../stores/titlebar.store";

type Platform = "darwin" | "windows" | "linux";

const TITLE_BAR_HEIGHT = 38;

function osToPlatform(os: string): Platform {
	if (os === "windows") return "windows";
	if (os === "linux") return "linux";
	return "darwin";
}

export const TitleBar: React.FC = () => {
	const [platform, setPlatform] = useState<Platform | null>(null);
	const [isFrameless, setIsFrameless] = useState(false);
	const { setChrome } = useTitleBarContext();

	useEffect(() => {
		let cancelled = false;
		// Resolve the OS from the backend, not the sync IsWindows/IsMac cache which
		// reads false until the runtime injects window._wails.
		(async () => {
			const { OS } = await System.Environment();
			const plat = osToPlatform(OS);
			const frameless = plat === "linux" ? await IsFrameless() : false;
			if (cancelled) return;
			setPlatform(plat);
			setIsFrameless(frameless);
			const shouldShow = plat === "darwin" || frameless;
			setChrome(shouldShow ? "frameless" : "hidden", shouldShow ? TITLE_BAR_HEIGHT / 16 : 0);
		})();
		return () => {
			cancelled = true;
		};
	}, [setChrome]);

	const handleMinimize = useCallback(() => {
		try {
			Window.Minimise();
		} catch {
			/* silently fail */
		}
	}, []);

	const handleMaximize = useCallback(() => {
		try {
			Window.ToggleMaximise();
		} catch {
			/* silently fail */
		}
	}, []);

	const handleClose = useCallback(() => {
		BackgroundQuit();
	}, []);

	if (platform === null) {
		return null;
	}

	const showChrome = platform === "darwin" || isFrameless;
	if (!showChrome) {
		return null;
	}

	const isMac = platform === "darwin";

	return (
		<div
			className={cn("chrome-titlebar", isMac ? "chrome-titlebar-mac" : "chrome-titlebar-win")}
			role="banner"
			aria-label="Application chrome"
		>
			<div className="flex items-center gap-2 flex-1 min-w-0">
				{!isMac && (
					<>
						<img
							src={logoImage}
							alt=""
							className="h-5 w-auto object-contain opacity-80"
							aria-hidden="true"
						/>
						<span className="text-xs font-semibold text-text-dim/70 tracking-wide select-none">
							YANTA
						</span>
					</>
				)}
			</div>

			{!isMac && (
				<div className="absolute left-1/2 -translate-x-1/2">
					<span className="text-xs text-text-dim/50 select-none">YANTA</span>
				</div>
			)}

			<div className="flex items-center gap-1">
				<button
					type="button"
					className="flex items-center justify-center w-10 h-7 rounded-sm text-text-dim/60 hover:text-text hover:bg-bg-dark transition-colors"
					onClick={handleMinimize}
					title="Minimize"
					aria-label="Minimize window"
				>
					<Minus className="w-3.5 h-3.5" />
				</button>
				<button
					type="button"
					className="flex items-center justify-center w-10 h-7 rounded-sm text-text-dim/60 hover:text-text hover:bg-bg-dark transition-colors"
					onClick={handleMaximize}
					title="Maximize"
					aria-label="Maximize window"
				>
					<Square className="w-3 h-3" />
				</button>
				<button
					type="button"
					className="flex items-center justify-center w-10 h-7 rounded-sm text-text-dim/60 hover:text-red hover:bg-red/10 transition-colors"
					onClick={handleClose}
					title="Close"
					aria-label="Close window"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	);
};

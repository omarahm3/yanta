import React from "react";
import { SettingsSection, Toggle } from "../../components/ui";
import type { SystemInfo } from "../../types";

interface GeneralSectionProps {
	systemInfo: SystemInfo | null;
	keepInBackground: boolean;
	startHidden: boolean;
	linuxWindowMode: string;
	onKeepInBackgroundToggle: (enabled: boolean) => void;
	onStartHiddenToggle: (enabled: boolean) => void;
	onLinuxWindowModeToggle: (frameless: boolean) => void;
}

export const GeneralSection = React.forwardRef<HTMLDivElement, GeneralSectionProps>(
	(
		{
			systemInfo,
			keepInBackground,
			startHidden,
			linuxWindowMode,
			onKeepInBackgroundToggle,
			onStartHiddenToggle,
			onLinuxWindowModeToggle,
		},
		ref,
	) => {
		const platform = systemInfo?.app?.platform ?? "";
		const isLinux = platform.includes("linux");
		const isMac = platform.includes("darwin");
		const backgroundUnavailable = isLinux || isMac;

		const isWindows = !isLinux && !isMac;

		return (
			<div ref={ref}>
				<SettingsSection title="General" subtitle="Application behavior settings">
					<div className="space-y-4">
						{isWindows && (
							<>
								<div className="flex items-center justify-between">
									<div>
										<div className="text-sm text-text">Keep running in background when closed</div>
										<div className="text-xs text-text-dim">
											When enabled, closing the window will hide YANTA instead of quitting. Press Ctrl+Shift+Y
											anywhere to restore the window.
										</div>
									</div>
									<Toggle checked={keepInBackground} onChange={onKeepInBackgroundToggle} />
								</div>

								<div className="flex items-center justify-between">
									<div>
										<div className="text-sm text-text">Start hidden in background</div>
										<div className="text-xs text-text-dim">
											When enabled, YANTA will start hidden. Press Ctrl+Shift+Y to show it. Requires "Keep
											running in background" to be enabled.
										</div>
									</div>
									<Toggle
										checked={startHidden}
										onChange={onStartHiddenToggle}
										disabled={!keepInBackground}
									/>
								</div>
							</>
						)}

						{isLinux && (
							<div className="flex items-center justify-between">
								<div>
									<div className="text-sm text-text">Frameless window mode</div>
									<div className="text-xs text-text-dim">
										Remove window borders and title bar for a cleaner look. You can drag the window using the
										custom title bar and resize from edges.
										<span className="text-yellow-400"> Requires restart to take effect.</span>
									</div>
								</div>
								<Toggle checked={linuxWindowMode === "frameless"} onChange={onLinuxWindowModeToggle} />
							</div>
						)}
					</div>
				</SettingsSection>
			</div>
		);
	},
);

GeneralSection.displayName = "GeneralSection";

import React from "react";
import { Select, type SelectOption, SettingsSection } from "../../components/ui";
import type { SystemInfo } from "../../types";

interface LoggingSectionProps {
	systemInfo: SystemInfo | null;
	logLevelOptions: SelectOption[];
	onLogLevelChange: (level: string) => void;
}

export const LoggingSection = React.forwardRef<HTMLDivElement, LoggingSectionProps>(
	({ systemInfo, logLevelOptions, onLogLevelChange }, ref) => {
		return (
			<div ref={ref}>
				<SettingsSection title="Logging" subtitle="Configure application logging level">
					<div className="space-y-4">
						<div className="space-y-2">
							<label className="block text-xs tracking-wider uppercase text-text-dim">Log Level</label>
							<Select
								value={systemInfo?.app.logLevel || "info"}
								onChange={onLogLevelChange}
								options={logLevelOptions}
							/>
							<div className="text-xs text-text-dim">
								Current level:{" "}
								<span className="font-mono text-accent">{systemInfo?.app.logLevel || "info"}</span>
							</div>
						</div>
					</div>
				</SettingsSection>
			</div>
		);
	},
);

LoggingSection.displayName = "LoggingSection";

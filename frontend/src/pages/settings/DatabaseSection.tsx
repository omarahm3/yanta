import React from "react";
import { Button, SettingsSection, Text } from "../../components/ui";
import type { SystemInfo } from "../../types";

interface DatabaseSectionProps {
	systemInfo: SystemInfo | null;
	isReindexing: boolean;
	reindexProgress: { current: number; total: number; message: string } | null;
	onReindex: () => void;
}

export const DatabaseSection = React.forwardRef<HTMLDivElement, DatabaseSectionProps>(
	({ systemInfo, isReindexing, reindexProgress, onReindex }, ref) => {
		return (
			<div ref={ref}>
				<SettingsSection
					title="Database"
					subtitle="Manage your local database and search index"
				>
					<div className="space-y-4">
						<div className="grid grid-cols-3 gap-4 p-4 border rounded border-border bg-bg-secondary">
							<div>
								<div className="text-xs text-text-dim uppercase">Documents</div>
								<div className="text-lg font-medium text-text">
									{systemInfo?.database.entriesCount ?? 0}
								</div>
							</div>
							<div>
								<div className="text-xs text-text-dim uppercase">Projects</div>
								<div className="text-lg font-medium text-text">
									{systemInfo?.database.projectsCount ?? 0}
								</div>
							</div>
							<div>
								<div className="text-xs text-text-dim uppercase">Storage</div>
								<div className="text-lg font-medium text-text">
									{systemInfo?.database.storageUsed ?? "Unknown"}
								</div>
							</div>
						</div>

						<div className="p-4 border rounded border-border">
							<div className="mb-3">
								<div className="mb-1 font-medium text-text">Rebuild Search Index</div>
								<Text size="xs" variant="dim">
									Recreate the database search index from your JSON files. Use this if
									search results seem incorrect or outdated.
								</Text>
							</div>

							{isReindexing && reindexProgress && (
								<div className="mb-3 space-y-1">
									<div className="text-sm text-text-dim">{reindexProgress.message}</div>
									{reindexProgress.total > 0 && (
										<div className="text-sm font-medium">
											{reindexProgress.current} / {reindexProgress.total} documents
										</div>
									)}
								</div>
							)}

							<Button
								onClick={onReindex}
								disabled={isReindexing}
								variant="secondary"
								size="sm"
							>
								{isReindexing ? "Reindexing..." : "Reindex Database"}
							</Button>
						</div>
					</div>
				</SettingsSection>
			</div>
		);
	},
);

DatabaseSection.displayName = "DatabaseSection";

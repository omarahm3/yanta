import React from "react";
import { SettingsSection } from "../../components/ui";
import { SystemInfo } from "../../types";

interface AboutSectionProps {
  systemInfo: SystemInfo | null;
}

export const AboutSection = React.forwardRef<HTMLDivElement, AboutSectionProps>(
  ({ systemInfo }, ref) => {
    return (
      <div ref={ref}>
        <SettingsSection
          title="About Yanta"
          subtitle="Version and system information"
        >
          {systemInfo ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                  Version
                </div>
                <div className="font-mono text-sm text-text">
                  {systemInfo.app.version}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                  Build Commit
                </div>
                <div className="font-mono text-sm text-cyan">
                  {systemInfo.app.buildCommit || "N/A"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                  Build Date
                </div>
                <div className="font-mono text-sm text-text">
                  {systemInfo.app.buildDate || "N/A"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                  Platform
                </div>
                <div className="font-mono text-sm text-text">
                  {systemInfo.app.platform}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                  Go Version
                </div>
                <div className="font-mono text-sm text-text">
                  {systemInfo.app.goVersion}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                  Documents
                </div>
                <div className="font-mono text-sm text-text">
                  {systemInfo.database.entriesCount}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                  Projects
                </div>
                <div className="font-mono text-sm text-text">
                  {systemInfo.database.projectsCount}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                  Tags
                </div>
                <div className="font-mono text-sm text-text">
                  {systemInfo.database.tagsCount}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                  Storage Used
                </div>
                <div className="font-mono text-sm text-text">
                  {systemInfo.database.storageUsed}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-text-dim">
              Loading system information...
            </div>
          )}
        </SettingsSection>
      </div>
    );
  },
);

AboutSection.displayName = "AboutSection";

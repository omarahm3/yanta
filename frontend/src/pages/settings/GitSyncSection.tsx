import React from "react";
import {
  SettingsSection,
  Toggle,
  Input,
  Button,
  Select,
  SelectOption,
} from "../../components/ui";
import { RiFolderOpenLine, RiAlertLine } from "react-icons/ri";

interface GitSyncSectionProps {
  gitInstalled: boolean;
  currentDataDir: string;
  migrationTarget: string;
  setMigrationTarget: (value: string) => void;
  isMigrating: boolean;
  migrationProgress: string;
  gitSyncEnabled: boolean;
  syncFrequency: string;
  autoPush: boolean;
  syncFrequencyOptions: SelectOption[];
  onGitSyncToggle: (enabled: boolean) => void;
  onSyncFrequencyChange: (frequency: string) => void;
  onAutoPushToggle: (enabled: boolean) => void;
  onPickDirectory: () => void;
  onMigration: () => void;
  onSyncNow: () => void;
}

export const GitSyncSection = React.forwardRef<
  HTMLDivElement,
  GitSyncSectionProps
>(
  (
    {
      gitInstalled,
      currentDataDir,
      migrationTarget,
      setMigrationTarget,
      isMigrating,
      migrationProgress,
      gitSyncEnabled,
      syncFrequency,
      autoPush,
      syncFrequencyOptions,
      onGitSyncToggle,
      onSyncFrequencyChange,
      onAutoPushToggle,
      onPickDirectory,
      onMigration,
      onSyncNow,
    },
    ref,
  ) => {
    return (
      <div ref={ref}>
        <SettingsSection
          title="Git Sync"
          subtitle="Sync your data with a Git repository"
        >
          <div className="space-y-4">
            {!gitInstalled && (
              <div className="flex items-start gap-2 text-xs text-text-dim">
                <RiAlertLine className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <span>
                  Git not found in PATH. Install Git to enable sync
                  functionality.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs tracking-wider uppercase text-text-dim">
                Current Data Directory
              </label>
              <div className="text-sm font-mono text-text">
                {currentDataDir || "Loading..."}
              </div>
            </div>

            <div className="pt-4 space-y-3 border-t border-border">
              <label className="block text-xs tracking-wider uppercase text-text-dim">
                Change Data Directory
              </label>
              <div className="text-xs text-text-dim">
                Move your data to a different directory. YANTA will restart
                after migration.
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    variant="default"
                    placeholder="/path/to/your/git/repo"
                    value={migrationTarget}
                    onChange={(e) => setMigrationTarget(e.target.value)}
                    disabled={isMigrating || !gitInstalled}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPickDirectory}
                    disabled={isMigrating || !gitInstalled}
                    title="Browse for folder"
                  >
                    <RiFolderOpenLine className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onMigration}
                  disabled={isMigrating || !gitInstalled || !migrationTarget}
                  className="w-full"
                >
                  {isMigrating ? "Migrating..." : "Migrate Data"}
                </Button>
              </div>
              {migrationProgress && (
                <div className="text-xs text-text-dim">{migrationProgress}</div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                <div className="text-sm text-text">Enable Git Sync</div>
                <div className="text-xs text-text-dim">
                  Automatically sync changes to Git
                </div>
              </div>
              <Toggle
                checked={gitSyncEnabled}
                onChange={onGitSyncToggle}
                disabled={!gitInstalled}
              />
            </div>

            {gitSyncEnabled && (
              <>
                <div className="space-y-2">
                  <label className="block text-xs tracking-wider uppercase text-text-dim">
                    Commit Mode
                  </label>
                  <Select
                    value={syncFrequency}
                    onChange={onSyncFrequencyChange}
                    options={syncFrequencyOptions}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <div className="text-sm text-text">Auto-push to remote</div>
                    <div className="text-xs text-text-dim">
                      Push commits to remote repository automatically
                    </div>
                  </div>
                  <Toggle
                    checked={autoPush}
                    onChange={onAutoPushToggle}
                    disabled={!gitInstalled}
                  />
                </div>

                <div className="space-y-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onSyncNow}
                    disabled={!gitInstalled}
                  >
                    Sync Now
                  </Button>
                </div>
              </>
            )}
          </div>
        </SettingsSection>
      </div>
    );
  },
);

GitSyncSection.displayName = "GitSyncSection";

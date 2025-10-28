import { useState, useEffect, useCallback } from "react";
import { SystemInfo, systemInfoFromModel } from "../../types";
import { SelectOption } from "../../components/ui";
import {
  GetSystemInfo,
  SetLogLevel,
  GetKeepInBackground,
  SetKeepInBackground,
  GetStartHidden,
  SetStartHidden,
  CheckGitInstalled,
  GetCurrentDataDirectory,
  ValidateMigrationTarget,
  MigrateToGitDirectory,
  GetGitSyncConfig,
  SetGitSyncConfig,
  SyncNow,
  OpenDirectoryDialog,
} from "../../../wailsjs/go/system/Service";
import { Quit } from "../../../wailsjs/runtime/runtime";
import { useNotification } from "../../hooks/useNotification";

interface GitSyncSettings {
  enabled: boolean;
  repositoryPath: string;
  remoteUrl: string;
  syncFrequency: string;
}

export const useSettingsController = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [keepInBackground, setKeepInBackgroundState] = useState(false);
  const [startHidden, setStartHiddenState] = useState(false);
  const [gitInstalled, setGitInstalled] = useState(true);
  const [currentDataDir, setCurrentDataDir] = useState("");
  const [migrationTarget, setMigrationTarget] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState("");
  const [gitSync, setGitSync] = useState<GitSyncSettings>({
    enabled: false,
    repositoryPath: "",
    remoteUrl: "",
    syncFrequency: "daily",
  });

  const { success, error } = useNotification();

  useEffect(() => {
    GetSystemInfo()
      .then((model) => setSystemInfo(systemInfoFromModel(model)))
      .catch((err) => console.error("Failed to fetch system info:", err));

    GetKeepInBackground()
      .then((value) => setKeepInBackgroundState(value))
      .catch((err) =>
        console.error("Failed to fetch keep in background setting:", err),
      );

    GetStartHidden()
      .then((value) => setStartHiddenState(value))
      .catch((err) =>
        console.error("Failed to fetch start hidden setting:", err),
      );

    CheckGitInstalled()
      .then((installed) => setGitInstalled(installed))
      .catch((err) => {
        console.error("Failed to check git installation:", err);
        setGitInstalled(false);
      });

    GetCurrentDataDirectory()
      .then((dir) => setCurrentDataDir(dir))
      .catch((err) =>
        console.error("Failed to get current data directory:", err),
      );

    GetGitSyncConfig()
      .then((config) => {
        setGitSync({
          enabled: config.Enabled,
          repositoryPath: config.RepositoryPath,
          remoteUrl: config.RemoteURL,
          syncFrequency: config.AutoCommit ? "realtime" : "manual",
        });
      })
      .catch((err) => console.error("Failed to get git sync config:", err));
  }, []);

  const handleLogLevelChange = useCallback(
    async (level: string) => {
      try {
        await SetLogLevel(level);
        setNeedsRestart(true);
        success(`Log level set to ${level}. Please restart the application.`);

        const model = await GetSystemInfo();
        setSystemInfo(systemInfoFromModel(model));
      } catch (err) {
        error(`Failed to set log level: ${err}`);
      }
    },
    [success, error],
  );

  const handleKeepInBackgroundToggle = useCallback(
    async (enabled: boolean) => {
      try {
        await SetKeepInBackground(enabled);
        setKeepInBackgroundState(enabled);
        if (!enabled) {
          setStartHiddenState(false);
        }
        success(
          enabled
            ? "Window will hide to background when closed"
            : "Window will quit when closed",
        );
      } catch (err) {
        error(`Failed to update setting: ${err}`);
      }
    },
    [success, error],
  );

  const handleStartHiddenToggle = useCallback(
    async (enabled: boolean) => {
      try {
        await SetStartHidden(enabled);
        setStartHiddenState(enabled);
        success(
          enabled
            ? "App will start hidden in background"
            : "App will start with window visible",
        );
      } catch (err) {
        error(`Failed to update setting: ${err}`);
      }
    },
    [success, error],
  );

  const handleGitSyncToggle = useCallback(
    async (enabled: boolean) => {
      try {
        const config = {
          Enabled: enabled,
          RepositoryPath: gitSync.repositoryPath,
          RemoteURL: gitSync.remoteUrl,
          AutoCommit: gitSync.syncFrequency === "realtime",
          AutoPush: false,
        };
        await SetGitSyncConfig(config);
        setGitSync((prev) => ({ ...prev, enabled }));
        success(enabled ? "Git sync enabled" : "Git sync disabled");
      } catch (err) {
        error(`Failed to update git sync: ${err}`);
      }
    },
    [success, error, gitSync],
  );

  const handleSyncFrequencyChange = useCallback(
    async (frequency: string) => {
      try {
        const config = {
          Enabled: gitSync.enabled,
          RepositoryPath: gitSync.repositoryPath,
          RemoteURL: gitSync.remoteUrl,
          AutoCommit: frequency === "realtime",
          AutoPush: false,
        };
        await SetGitSyncConfig(config);
        setGitSync((prev) => ({ ...prev, syncFrequency: frequency }));
        success("Sync frequency updated");
      } catch (err) {
        error(`Failed to update sync frequency: ${err}`);
      }
    },
    [gitSync, success, error],
  );

  const handleRemoteUrlChange = useCallback(
    async (url: string) => {
      try {
        const config = {
          Enabled: gitSync.enabled,
          RepositoryPath: gitSync.repositoryPath,
          RemoteURL: url,
          AutoCommit: gitSync.syncFrequency === "realtime",
          AutoPush: false,
        };
        await SetGitSyncConfig(config);
        setGitSync((prev) => ({ ...prev, remoteUrl: url }));
      } catch (err) {
        error(`Failed to update remote URL: ${err}`);
      }
    },
    [gitSync, error],
  );

  const handlePickDirectory = useCallback(async () => {
    try {
      const selected = await OpenDirectoryDialog();
      if (selected) {
        setMigrationTarget(selected);
      }
    } catch (err) {
      error(`Failed to open directory picker: ${err}`);
    }
  }, [error]);

  const handleMigration = useCallback(async () => {
    if (!migrationTarget) {
      error("Please enter a target directory");
      return;
    }

    try {
      setIsMigrating(true);
      setMigrationProgress("Validating target directory...");

      await ValidateMigrationTarget(migrationTarget);

      setMigrationProgress("Migrating data...");
      await MigrateToGitDirectory(migrationTarget, gitSync.remoteUrl);

      setMigrationProgress("Migration complete! App will exit in 2 seconds...");
      success(
        "Migration completed! Please restart YANTA to use the new location.",
      );
    } catch (err) {
      error(`Migration failed: ${err}`);
      setIsMigrating(false);
      setMigrationProgress("");
    }
  }, [migrationTarget, gitSync.remoteUrl, success, error]);

  const handleSyncNow = useCallback(async () => {
    try {
      await SyncNow();
      success("Sync completed successfully");
    } catch (err) {
      error(`Sync failed: ${err}`);
    }
  }, [success, error]);

  const logLevelOptions: SelectOption[] = [
    { value: "debug", label: "Debug" },
    { value: "info", label: "Info" },
    { value: "warn", label: "Warning" },
    { value: "error", label: "Error" },
  ];

  const syncFrequencyOptions: SelectOption[] = [
    { value: "realtime", label: "Auto-commit (after every save)" },
    { value: "manual", label: "Manual sync only" },
  ];

  return {
    systemInfo,
    needsRestart,
    keepInBackground,
    startHidden,
    gitInstalled,
    currentDataDir,
    migrationTarget,
    setMigrationTarget,
    isMigrating,
    migrationProgress,
    gitSync,
    logLevelOptions,
    syncFrequencyOptions,
    handlers: {
      handleLogLevelChange,
      handleKeepInBackgroundToggle,
      handleStartHiddenToggle,
      handleGitSyncToggle,
      handleSyncFrequencyChange,
      handleRemoteUrlChange,
      handlePickDirectory,
      handleMigration,
      handleSyncNow,
    },
  };
};

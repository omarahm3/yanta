import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsPage } from "../hooks/useSettingsPage";

vi.mock("../../help", () => ({
	useHelp: () => ({ setPageContext: vi.fn() }),
}));

vi.mock("../../shared/hooks/useSidebarSections", () => ({
	useSidebarSections: () => [],
}));

vi.mock("../../shared/hooks", async () => {
	const actual = await vi.importActual<typeof import("../../shared/hooks")>("../../shared/hooks");
	return {
		...actual,
		useSidebarSetting: () => ({ sidebarVisible: true, setSidebarVisible: vi.fn(), isLoading: false }),
		useFooterHintsSetting: () => ({
			showFooterHints: true,
			setShowFooterHints: vi.fn(),
			isLoading: false,
		}),
		useShortcutTooltipsSetting: () => ({
			showShortcutTooltips: true,
			setShowShortcutTooltips: vi.fn(),
			isLoading: false,
		}),
		useFeatureFlag: () => ({ enabled: false }),
		useGitStatus: () => ({ status: null, isLoading: false, error: null, refresh: vi.fn() }),
	};
});

vi.mock("../../hotkeys", () => ({
	useHotkeys: vi.fn(),
}));

vi.mock("../useSettingsController", () => ({
	useSettingsController: () => ({
		systemInfo: null,
		needsRestart: false,
		keepInBackground: false,
		startHidden: false,
		linuxWindowMode: "normal",
		gitInstalled: true,
		currentDataDir: "/test/dir",
		migrationTarget: "",
		setMigrationTarget: vi.fn(),
		isMigrating: false,
		migrationProgress: "",
		dataDirOverridden: false,
		dataDirEnvVar: "",
		appScale: 1.0,
		isReindexing: false,
		reindexProgress: null,
		showReindexConfirm: false,
		gitSync: { enabled: false, commitInterval: 10, autoPush: true, branch: "" },
		gitBranches: [],
		currentGitBranch: "",
		backupConfig: { Enabled: false, MaxBackups: 5 },
		backups: [],
		hotkeyConfig: { quickCaptureEnabled: false, quickCaptureHotkey: "Ctrl+Shift+N" },
		hotkeyError: undefined,
		platform: "linux",
		conflictInfo: null,
		showConflictDialog: false,
		logLevelOptions: [],
		commitIntervalOptions: [],
		handlers: {
			handleLogLevelChange: vi.fn(),
			handleKeepInBackgroundToggle: vi.fn(),
			handleStartHiddenToggle: vi.fn(),
			handleLinuxWindowModeToggle: vi.fn(),
			handleGitSyncToggle: vi.fn(),
			handleCommitIntervalChange: vi.fn(),
			handleAutoPushToggle: vi.fn(),
			handleBranchChange: vi.fn(),
			handlePickDirectory: vi.fn(),
			handleMigration: vi.fn(),
			handleSyncNow: vi.fn(),
			handleAppScaleChange: vi.fn(),
			handleRequestReindex: vi.fn(),
			handleCancelReindex: vi.fn(),
			handleConfirmReindex: vi.fn(),
			handleHotkeyConfigChange: vi.fn(),
			handleBackupToggle: vi.fn(),
			handleMaxBackupsChange: vi.fn(),
			handleRestoreBackup: vi.fn(),
			handleDeleteBackup: vi.fn(),
			handleConflictConfirm: vi.fn(),
			handleConflictCancel: vi.fn(),
		},
	}),
}));

let capturedSections: { id: string; label: string; keywords: string }[] = [];

const Probe: React.FC = () => {
	const { sections } = useSettingsPage({});
	capturedSections = sections;
	return (
		<ul data-testid="section-list">
			{sections.map((s) => (
				<li key={s.id} data-section-id={s.id}>
					{s.label}
				</li>
			))}
		</ul>
	);
};

describe("Settings section labels (MRG-392)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		capturedSections = [];
	});

	it("renders user-facing labels instead of implementation jargon", () => {
		render(<Probe />);

		const labels = screen.getAllByRole("listitem").map((li) => li.textContent);

		expect(labels).toContain("Storage");
		expect(labels).toContain("Diagnostics");
		expect(labels).not.toContain("Database");
		expect(labels).not.toContain("Logging");
	});

	it("preserves existing user-friendly section labels", () => {
		render(<Probe />);

		const labels = screen.getAllByRole("listitem").map((li) => li.textContent);

		expect(labels).toContain("General");
		expect(labels).toContain("Appearance");
		expect(labels).toContain("Keyboard Shortcuts");
		expect(labels).toContain("Backup");
		expect(labels).toContain("Git Sync");
		expect(labels).toContain("MCP Server");
		expect(labels).toContain("About");
	});

	it("Storage section keywords still match database-related queries", () => {
		render(<Probe />);
		const storage = capturedSections.find((s) => s.id === "database");
		expect(storage).toBeDefined();
		expect(storage!.label).toBe("Storage");
		expect(storage!.keywords).toMatch(/database|reindex|storage/);
	});

	it("Diagnostics section keywords still match log-related queries", () => {
		render(<Probe />);
		const diag = capturedSections.find((s) => s.id === "logging");
		expect(diag).toBeDefined();
		expect(diag!.label).toBe("Diagnostics");
		expect(diag!.keywords).toMatch(/log|debug|diagnostics/);
	});
});

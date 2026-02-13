import { render, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { DialogProvider, TitleBarProvider } from "../app/context";
import { HotkeyProvider, useHotkeyContext } from "../hotkeys";
import { Settings } from "../settings";
import type { HotkeyContextValue } from "../shared/types/hotkeys";

vi.mock("../help", () => ({
	useHelp: () => ({ setPageContext: vi.fn() }),
}));

vi.mock("../shared/hooks/useSidebarSections", () => ({
	useSidebarSections: () => [],
}));

vi.mock("../settings/useSettingsController", () => ({
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

vi.mock("../project", async () => {
	const actual = await vi.importActual<typeof import("../project")>("../project");
	return {
		...actual,
		useProjectContext: () => ({
			currentProject: { name: "Test Project" },
		}),
	};
});

vi.mock("../../wailsjs/runtime/runtime", () => ({
	EventsOn: vi.fn(() => () => {}),
}));

vi.mock("../shared/ui/Toast", () => ({
	ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	useToast: () => ({
		show: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		dismiss: vi.fn(),
		dismissAll: vi.fn(),
	}),
}));

const HotkeyProbe: React.FC<{ onReady: (ctx: HotkeyContextValue) => void }> = ({ onReady }) => {
	const ctx = useHotkeyContext();
	React.useEffect(() => {
		onReady(ctx);
	}, [ctx, onReady]);
	return null;
};

const renderSettings = async () => {
	let context: HotkeyContextValue | null = null;

	const result = render(
		<DialogProvider>
			<HotkeyProvider>
				<TitleBarProvider>
					{/* biome-ignore lint/suspicious/noAssignInExpressions: Test callback pattern */}
					<HotkeyProbe onReady={(ctx) => (context = ctx)} />
					<Settings onNavigate={vi.fn()} />
				</TitleBarProvider>
			</HotkeyProvider>
		</DialogProvider>,
	);

	await waitFor(() => {
		expect(context).not.toBeNull();
	});

	// biome-ignore lint/style/noNonNullAssertion: Test utility function ensures non-null
	return { context: context!, ...result };
};

describe("Settings hotkeys", () => {
	it("registers j and k hotkeys", async () => {
		const { context } = await renderSettings();

		const registeredHotkeys = context.getRegisteredHotkeys();
		const hotkeyKeys = registeredHotkeys.map((h) => h.key);

		expect(hotkeyKeys).toContain("j");
		expect(hotkeyKeys).toContain("k");
	});

	it("j hotkey navigates to next section", async () => {
		const { context } = await renderSettings();

		const jHotkey = context.getRegisteredHotkeys().find((h) => h.key === "j");
		expect(jHotkey).toBeDefined();
		expect(jHotkey?.description).toBe("Next section");
		expect(jHotkey?.allowInInput).toBe(false);
	});

	it("k hotkey navigates to previous section", async () => {
		const { context } = await renderSettings();

		const kHotkey = context.getRegisteredHotkeys().find((h) => h.key === "k");
		expect(kHotkey).toBeDefined();
		expect(kHotkey?.description).toBe("Previous section");
		expect(kHotkey?.allowInInput).toBe(false);
	});
});

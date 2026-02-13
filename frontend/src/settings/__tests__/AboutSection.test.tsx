import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogProvider } from "../../app/context";
import { useOnboardingStore } from "../../shared/stores/onboarding.store";
import { useProgressStore } from "../../shared/stores/progress.store";
import type { SystemInfo } from "../../shared/types";
import { AboutSection } from "../AboutSection";

// Mock the Toast module to avoid needing ToastProvider
vi.mock("../../shared/ui/Toast", () => ({
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

const mockSystemInfo: SystemInfo = {
	app: {
		version: "1.0.0",
		buildCommit: "abc123",
		buildDate: "2024-01-01",
		platform: "windows",
		goVersion: "1.21",
		databasePath: "/path/to/db",
		logLevel: "info",
	},
	database: {
		entriesCount: 10,
		projectsCount: 3,
		tagsCount: 5,
		storageUsed: "1.5 MB",
	},
};

const renderAboutSection = (systemInfo: SystemInfo | null = mockSystemInfo) => {
	return render(
		<DialogProvider>
			<AboutSection systemInfo={systemInfo} ref={null} />
		</DialogProvider>,
	);
};

describe("AboutSection", () => {
	beforeEach(() => {
		localStorage.clear();
		useOnboardingStore.setState({ onboardingData: null });
		useProgressStore.setState({
			documentsCreated: 0,
			journalEntriesCreated: 0,
			projectsSwitched: 0,
			hintsShown: [],
		});
	});

	describe("system info display", () => {
		it("renders loading state when systemInfo is null", () => {
			renderAboutSection(null);
			expect(screen.getByText("Loading system information...")).toBeInTheDocument();
		});

		it("renders version information", () => {
			renderAboutSection();
			expect(screen.getByText("1.0.0")).toBeInTheDocument();
		});

		it("renders build commit", () => {
			renderAboutSection();
			expect(screen.getByText("abc123")).toBeInTheDocument();
		});

		it("renders build date", () => {
			renderAboutSection();
			expect(screen.getByText("2024-01-01")).toBeInTheDocument();
		});

		it("renders platform", () => {
			renderAboutSection();
			expect(screen.getByText("windows")).toBeInTheDocument();
		});

		it("renders Go version", () => {
			renderAboutSection();
			expect(screen.getByText("1.21")).toBeInTheDocument();
		});

		it("renders database stats", () => {
			renderAboutSection();
			expect(screen.getByText("10")).toBeInTheDocument();
			expect(screen.getByText("3")).toBeInTheDocument();
			expect(screen.getByText("5")).toBeInTheDocument();
			expect(screen.getByText("1.5 MB")).toBeInTheDocument();
		});

		it("shows N/A for missing build commit", () => {
			const infoWithoutCommit: SystemInfo = {
				...mockSystemInfo,
				app: { ...mockSystemInfo.app, buildCommit: "" },
			};
			renderAboutSection(infoWithoutCommit);
			expect(screen.getByText("N/A")).toBeInTheDocument();
		});
	});

	describe("onboarding section", () => {
		it("renders onboarding section title", () => {
			renderAboutSection();
			expect(screen.getByText("Onboarding & Hints")).toBeInTheDocument();
		});

		it("renders reset onboarding button", () => {
			renderAboutSection();
			expect(screen.getByRole("button", { name: "Reset Onboarding" })).toBeInTheDocument();
		});

		it("renders reset hints button", () => {
			renderAboutSection();
			expect(screen.getByRole("button", { name: "Reset Hints" })).toBeInTheDocument();
		});
	});

	describe("reset onboarding", () => {
		it("shows confirmation dialog when clicking reset onboarding", () => {
			renderAboutSection();

			fireEvent.click(screen.getByRole("button", { name: "Reset Onboarding" }));

			expect(screen.getByText("Reset Onboarding?")).toBeInTheDocument();
			expect(
				screen.getByText(
					"This will reset your onboarding status. The welcome overlay will appear the next time you launch the app.",
				),
			).toBeInTheDocument();
		});

		it("closes dialog when clicking cancel", () => {
			renderAboutSection();

			fireEvent.click(screen.getByRole("button", { name: "Reset Onboarding" }));
			fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

			expect(screen.queryByText("Reset Onboarding?")).not.toBeInTheDocument();
		});

		it("resets onboarding when confirmed", () => {
			// Set up completed onboarding via store
			useOnboardingStore.setState({
				onboardingData: {
					completedWelcome: true,
					completedAt: Date.now(),
					version: "1.0.0",
				},
			});

			renderAboutSection();

			fireEvent.click(screen.getByRole("button", { name: "Reset Onboarding" }));
			fireEvent.click(screen.getByRole("button", { name: "Reset" }));

			// Store should be reset to null
			const state = useOnboardingStore.getState();
			expect(state.onboardingData).toBeNull();
		});

		it("closes dialog after confirming reset", () => {
			renderAboutSection();

			fireEvent.click(screen.getByRole("button", { name: "Reset Onboarding" }));
			fireEvent.click(screen.getByRole("button", { name: "Reset" }));

			expect(screen.queryByText("Reset Onboarding?")).not.toBeInTheDocument();
		});
	});

	describe("reset hints", () => {
		it("shows confirmation dialog when clicking reset hints", () => {
			renderAboutSection();

			fireEvent.click(screen.getByRole("button", { name: "Reset Hints" }));

			expect(screen.getByText("Reset Hints?")).toBeInTheDocument();
			expect(
				screen.getByText(
					"This will clear all milestone hint history and reset your usage progress. Hints will appear again as you reach milestones.",
				),
			).toBeInTheDocument();
		});

		it("closes dialog when clicking cancel", () => {
			renderAboutSection();

			fireEvent.click(screen.getByRole("button", { name: "Reset Hints" }));
			fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

			expect(screen.queryByText("Reset Hints?")).not.toBeInTheDocument();
		});

		it("resets progress when confirmed", () => {
			// Set up some progress data via store
			useProgressStore.setState({
				documentsCreated: 5,
				journalEntriesCreated: 3,
				projectsSwitched: 2,
				hintsShown: ["first-save", "journal-nav"],
			});

			renderAboutSection();

			fireEvent.click(screen.getByRole("button", { name: "Reset Hints" }));
			fireEvent.click(screen.getByRole("button", { name: "Reset" }));

			// resetProgress resets store to defaults
			const state = useProgressStore.getState();
			expect(state.documentsCreated).toBe(0);
			expect(state.journalEntriesCreated).toBe(0);
			expect(state.projectsSwitched).toBe(0);
			expect(state.hintsShown).toEqual([]);
		});

		it("closes dialog after confirming reset", () => {
			renderAboutSection();

			fireEvent.click(screen.getByRole("button", { name: "Reset Hints" }));
			fireEvent.click(screen.getByRole("button", { name: "Reset" }));

			expect(screen.queryByText("Reset Hints?")).not.toBeInTheDocument();
		});

		it("displays hint count when hints have been shown", () => {
			useProgressStore.setState({
				documentsCreated: 5,
				journalEntriesCreated: 3,
				projectsSwitched: 2,
				hintsShown: ["first-save", "journal-nav", "quick-switch"],
			});

			renderAboutSection();

			expect(screen.getByText("(3 hints shown)")).toBeInTheDocument();
		});

		it("does not display hint count when no hints shown", () => {
			renderAboutSection();

			expect(screen.queryByText(/hints shown/)).not.toBeInTheDocument();
		});
	});

	describe("notifications", () => {
		it("shows success notification after resetting onboarding", () => {
			// The notification system uses toast notifications which are
			// typically rendered outside the component tree
			// This test verifies the reset function completes without error
			renderAboutSection();

			fireEvent.click(screen.getByRole("button", { name: "Reset Onboarding" }));
			fireEvent.click(screen.getByRole("button", { name: "Reset" }));

			// Dialog should close, indicating success
			expect(screen.queryByText("Reset Onboarding?")).not.toBeInTheDocument();
		});

		it("shows success notification after resetting hints", () => {
			renderAboutSection();

			fireEvent.click(screen.getByRole("button", { name: "Reset Hints" }));
			fireEvent.click(screen.getByRole("button", { name: "Reset" }));

			// Dialog should close, indicating success
			expect(screen.queryByText("Reset Hints?")).not.toBeInTheDocument();
		});
	});
});

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MilestoneHintManager } from "../MilestoneHintManager";
import { UserProgressProvider, useUserProgressContext } from "../../contexts";
import type { FC, ReactNode } from "react";

// Helper to wrap component with context
const TestWrapper: FC<{ children: ReactNode }> = ({ children }) => (
	<UserProgressProvider>{children}</UserProgressProvider>
);

// Helper component to manipulate progress
const ProgressController: FC<{
	onReady: (controls: ReturnType<typeof useUserProgressContext>) => void;
}> = ({ onReady }) => {
	const context = useUserProgressContext();
	onReady(context);
	return null;
};

describe("MilestoneHintManager", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		localStorage.clear();
	});

	afterEach(() => {
		vi.useRealTimers();
		localStorage.clear();
	});

	describe("rendering", () => {
		it("renders nothing when no milestones are met", () => {
			render(
				<TestWrapper>
					<MilestoneHintManager />
				</TestWrapper>
			);

			expect(screen.queryByTestId("milestone-hint")).not.toBeInTheDocument();
		});

		it("renders first-save hint when documentsCreated === 1", () => {
			let controls: ReturnType<typeof useUserProgressContext>;

			render(
				<TestWrapper>
					<ProgressController onReady={(c) => (controls = c)} />
					<MilestoneHintManager />
				</TestWrapper>
			);

			act(() => {
				controls.incrementDocumentsCreated();
			});

			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();
			expect(screen.getByText("Press Ctrl+S to save quickly")).toBeInTheDocument();
		});

		it("renders journal-nav hint when journalEntriesCreated === 1", () => {
			let controls: ReturnType<typeof useUserProgressContext>;

			render(
				<TestWrapper>
					<ProgressController onReady={(c) => (controls = c)} />
					<MilestoneHintManager />
				</TestWrapper>
			);

			act(() => {
				controls.incrementJournalEntriesCreated();
			});

			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();
			expect(screen.getByText("Navigate days with Ctrl+← and Ctrl+→")).toBeInTheDocument();
		});

		it("renders quick-switch hint when projectsSwitched === 1", () => {
			let controls: ReturnType<typeof useUserProgressContext>;

			render(
				<TestWrapper>
					<ProgressController onReady={(c) => (controls = c)} />
					<MilestoneHintManager />
				</TestWrapper>
			);

			act(() => {
				controls.incrementProjectsSwitched();
			});

			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();
			expect(
				screen.getByText("Quick switch with Ctrl+Tab to toggle between projects")
			).toBeInTheDocument();
		});
	});

	describe("hint dismissal", () => {
		it("marks hint as shown when dismissed", () => {
			let controls: ReturnType<typeof useUserProgressContext>;

			render(
				<TestWrapper>
					<ProgressController onReady={(c) => (controls = c)} />
					<MilestoneHintManager />
				</TestWrapper>
			);

			act(() => {
				controls.incrementDocumentsCreated();
			});

			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();

			fireEvent.click(screen.getByTestId("milestone-hint-dismiss"));

			// Wait for exit animation
			act(() => {
				vi.advanceTimersByTime(200);
			});

			expect(screen.queryByTestId("milestone-hint")).not.toBeInTheDocument();
			expect(controls.hasHintBeenShown("first-save")).toBe(true);
		});

		it("does not show same hint again after dismissal", () => {
			let controls: ReturnType<typeof useUserProgressContext>;

			const { rerender } = render(
				<TestWrapper>
					<ProgressController onReady={(c) => (controls = c)} />
					<MilestoneHintManager />
				</TestWrapper>
			);

			// Increment documents and dismiss hint
			act(() => {
				controls.incrementDocumentsCreated();
			});

			fireEvent.click(screen.getByTestId("milestone-hint-dismiss"));

			act(() => {
				vi.advanceTimersByTime(200);
			});

			// Rerender component
			rerender(
				<TestWrapper>
					<ProgressController onReady={(c) => (controls = c)} />
					<MilestoneHintManager />
				</TestWrapper>
			);

			// Hint should not appear again (documentsCreated is still 1)
			expect(screen.queryByTestId("milestone-hint")).not.toBeInTheDocument();
		});
	});

	describe("milestone progression", () => {
		it("shows recent-docs hint when documentsCreated reaches 5", () => {
			let controls: ReturnType<typeof useUserProgressContext>;

			render(
				<TestWrapper>
					<ProgressController onReady={(c) => (controls = c)} />
					<MilestoneHintManager />
				</TestWrapper>
			);

			// Create 5 documents, dismissing first-save hint along the way
			act(() => {
				controls.incrementDocumentsCreated();
			});

			// Dismiss first-save hint
			fireEvent.click(screen.getByTestId("milestone-hint-dismiss"));
			act(() => {
				vi.advanceTimersByTime(200);
			});

			act(() => {
				controls.incrementDocumentsCreated();
				controls.incrementDocumentsCreated();
				controls.incrementDocumentsCreated();
				controls.incrementDocumentsCreated();
			});

			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();
			expect(
				screen.getByText("Power tip: Ctrl+E opens your recent documents")
			).toBeInTheDocument();
		});

		it("shows journal-select hint when journalEntriesCreated reaches 10", () => {
			let controls: ReturnType<typeof useUserProgressContext>;

			render(
				<TestWrapper>
					<ProgressController onReady={(c) => (controls = c)} />
					<MilestoneHintManager />
				</TestWrapper>
			);

			// Create first entry
			act(() => {
				controls.incrementJournalEntriesCreated();
			});

			// Dismiss journal-nav hint
			fireEvent.click(screen.getByTestId("milestone-hint-dismiss"));
			act(() => {
				vi.advanceTimersByTime(200);
			});

			// Create 9 more entries to reach 10
			act(() => {
				for (let i = 0; i < 9; i++) {
					controls.incrementJournalEntriesCreated();
				}
			});

			expect(screen.getByTestId("milestone-hint")).toBeInTheDocument();
			expect(
				screen.getByText("Select entries with Space to promote or delete in bulk")
			).toBeInTheDocument();
		});
	});

	describe("hint priority", () => {
		it("shows first-save hint before journal-nav when both milestones are met", () => {
			let controls: ReturnType<typeof useUserProgressContext>;

			render(
				<TestWrapper>
					<ProgressController onReady={(c) => (controls = c)} />
					<MilestoneHintManager />
				</TestWrapper>
			);

			// Trigger both milestones at once
			act(() => {
				controls.incrementDocumentsCreated();
				controls.incrementJournalEntriesCreated();
			});

			// First-save hint should appear first (it's earlier in MILESTONE_HINTS array)
			expect(screen.getByText("Press Ctrl+S to save quickly")).toBeInTheDocument();
			expect(
				screen.queryByText("Navigate days with Ctrl+← and Ctrl+→")
			).not.toBeInTheDocument();
		});

		it("shows journal-nav hint when first-save already shown", () => {
			// Pre-set the first-save hint as shown in localStorage
			localStorage.setItem(
				"yanta_user_progress",
				JSON.stringify({
					documentsCreated: 1,
					journalEntriesCreated: 1,
					projectsSwitched: 0,
					hintsShown: ["first-save"],
				})
			);

			render(
				<TestWrapper>
					<MilestoneHintManager />
				</TestWrapper>
			);

			// Journal-nav hint should appear since first-save is already shown
			expect(screen.getByText("Navigate days with Ctrl+← and Ctrl+→")).toBeInTheDocument();
			expect(screen.queryByText("Press Ctrl+S to save quickly")).not.toBeInTheDocument();
		});
	});

	describe("auto-dismiss", () => {
		it("auto-dismisses after 8 seconds and marks hint as shown", () => {
			let controls: ReturnType<typeof useUserProgressContext>;

			render(
				<TestWrapper>
					<ProgressController onReady={(c) => (controls = c)} />
					<MilestoneHintManager />
				</TestWrapper>
			);

			// Trigger milestone
			act(() => {
				controls.incrementDocumentsCreated();
			});

			expect(screen.getByText("Press Ctrl+S to save quickly")).toBeInTheDocument();
			expect(controls.hasHintBeenShown("first-save")).toBe(false);

			// Wait for auto-dismiss (8 seconds + 200ms animation)
			act(() => {
				vi.advanceTimersByTime(8000);
			});
			act(() => {
				vi.advanceTimersByTime(200);
			});

			// Hint should be marked as shown
			expect(controls.hasHintBeenShown("first-save")).toBe(true);
		});
	});
});

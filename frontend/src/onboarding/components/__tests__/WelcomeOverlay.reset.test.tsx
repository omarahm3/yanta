import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOnboardingStore } from "../../../shared/stores/onboarding.store";
import { WelcomeOverlay } from "../WelcomeOverlay";

const STORAGE_KEY = "yanta_onboarding";

describe("WelcomeOverlay — onboarding reset (MRG-381)", () => {
	beforeEach(() => {
		localStorage.clear();
		useOnboardingStore.setState({ onboardingData: null });
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("shows overlay again after onboarding is reset", () => {
		useOnboardingStore.setState({
			onboardingData: {
				completedWelcome: true,
				completedAt: 1000,
				version: "1.0.0",
			},
		});

		const { rerender } = render(<WelcomeOverlay />);

		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();

		act(() => {
			useOnboardingStore.getState().resetOnboarding();
		});

		rerender(<WelcomeOverlay />);

		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(screen.getByTestId("welcome-overlay")).toBeInTheDocument();
	});

	it("reset clears localStorage so overlay reappears on fresh mount", () => {
		useOnboardingStore.setState({
			onboardingData: {
				completedWelcome: true,
				completedAt: 1000,
				version: "1.0.0",
			},
		});

		act(() => {
			useOnboardingStore.getState().resetOnboarding();
		});

		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

		const { unmount } = render(<WelcomeOverlay />);

		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(screen.getByTestId("welcome-overlay")).toBeInTheDocument();

		unmount();
	});
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppearanceStore } from "../../shared/stores/appearance.store";
import { AppearanceSection } from "../AppearanceSection";

const DEFAULT_PROPS = {
	platform: "darwin",
	appScale: 1.0,
	onAppScaleChange: vi.fn(),
	theme: "dark" as const,
	onThemeChange: vi.fn(),
	linuxGraphicsMode: "auto" as const,
	onLinuxGraphicsModeChange: vi.fn(),
	sidebarVisible: true,
	onSidebarVisibleChange: vi.fn(),
	showFooterHints: true,
	onShowFooterHintsChange: vi.fn(),
	showShortcutTooltips: false,
	onShowShortcutTooltipsChange: vi.fn(),
	tooltipHintsFeatureEnabled: false,
};

describe("AppearanceSection", () => {
	beforeEach(() => {
		useAppearanceStore.setState({ reducedEffects: false, densityMode: "normal" });
		vi.clearAllMocks();
	});

	describe("theme gallery", () => {
		it("renders three theme radio buttons", () => {
			render(<AppearanceSection {...DEFAULT_PROPS} />);
			const radios = screen.getAllByRole("radio");
			const themeRadios = radios.filter(
				(r) => r.closest('[aria-label="Theme"]') !== null,
			);
			expect(themeRadios).toHaveLength(3);
		});

		it("marks the active theme as checked", () => {
			render(<AppearanceSection {...DEFAULT_PROPS} theme="light" />);
			const group = screen.getByRole("radiogroup", { name: "Theme" });
			const lightBtn = Array.from(group.querySelectorAll("[role=radio]")).find(
				(el) => el.textContent?.includes("Light"),
			) as HTMLElement;
			expect(lightBtn.getAttribute("aria-checked")).toBe("true");
		});

		it("calls onThemeChange when a theme card is clicked", async () => {
			const user = userEvent.setup();
			const onThemeChange = vi.fn();
			render(<AppearanceSection {...DEFAULT_PROPS} onThemeChange={onThemeChange} />);
			const group = screen.getByRole("radiogroup", { name: "Theme" });
			const systemBtn = Array.from(group.querySelectorAll("[role=radio]")).find(
				(el) => el.textContent?.includes("System"),
			) as HTMLElement;
			await user.click(systemBtn);
			expect(onThemeChange).toHaveBeenCalledWith("system");
		});
	});

	describe("density picker", () => {
		it("renders three density options", () => {
			render(<AppearanceSection {...DEFAULT_PROPS} />);
			const group = screen.getByRole("radiogroup", { name: "Density" });
			expect(group.querySelectorAll("[role=radio]")).toHaveLength(3);
		});

		it("shows the current density as checked", () => {
			useAppearanceStore.setState({ densityMode: "compact" });
			render(<AppearanceSection {...DEFAULT_PROPS} />);
			const group = screen.getByRole("radiogroup", { name: "Density" });
			const compactBtn = Array.from(group.querySelectorAll("[role=radio]")).find(
				(el) => el.textContent?.includes("Compact"),
			) as HTMLElement;
			expect(compactBtn.getAttribute("aria-checked")).toBe("true");
		});

		it("updates the store when a density button is clicked", async () => {
			const user = userEvent.setup();
			render(<AppearanceSection {...DEFAULT_PROPS} />);
			const group = screen.getByRole("radiogroup", { name: "Density" });
			const comfortableBtn = Array.from(group.querySelectorAll("[role=radio]")).find(
				(el) => el.textContent?.includes("Comfortable"),
			) as HTMLElement;
			await user.click(comfortableBtn);
			expect(useAppearanceStore.getState().densityMode).toBe("comfortable");
		});
	});

	describe("linux graphics section", () => {
		it("hides the Linux graphics mode section on non-Linux platforms", () => {
			render(<AppearanceSection {...DEFAULT_PROPS} platform="darwin" />);
			expect(screen.queryByText("Linux Graphics Mode")).toBeNull();
		});

		it("shows the Linux graphics mode section on Linux", () => {
			render(<AppearanceSection {...DEFAULT_PROPS} platform="linux/amd64" />);
			expect(screen.getByText("Linux Graphics Mode")).toBeInTheDocument();
		});
	});
});

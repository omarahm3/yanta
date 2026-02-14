import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { DialogProvider } from "../../app/context";
import { PluginsSection } from "../PluginsSection";
import type { PluginInstallRecord } from "../usePluginSettings";

// Mock toast module to avoid provider requirement in dialog internals.
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

const samplePlugins: PluginInstallRecord[] = [
	{
		manifest: {
			ID: "good.plugin",
			Name: "Good Plugin",
			Version: "1.0.0",
			APIVersion: "1",
			Entry: "index.js",
			Capabilities: ["commands"],
			Description: "",
			Author: "",
			Homepage: "",
		},
		path: "/plugins/good.plugin",
		source: "local",
		enabled: true,
		isolation: "trusted_builtin",
		canExecute: true,
		status: "ok",
		issues: [],
	},
	{
		manifest: {
			ID: "bad.plugin",
			Name: "Bad Plugin",
			Version: "1.0.0",
			APIVersion: "2",
			Entry: "index.js",
			Capabilities: ["commands"],
			Description: "",
			Author: "",
			Homepage: "",
		},
		path: "/plugins/bad.plugin",
		source: "local",
		enabled: false,
		isolation: "quarantined_local",
		canExecute: false,
		status: "incompatible_api",
		issues: [{ code: "INCOMPATIBLE_API_VERSION", message: "api mismatch", field: "api_version" }],
	},
] as unknown as PluginInstallRecord[];

function renderSection(props?: Partial<React.ComponentProps<typeof PluginsSection>>) {
	const mergedProps: React.ComponentProps<typeof PluginsSection> = {
		plugins: samplePlugins,
		isLoading: false,
		errorMessage: null,
		pluginDirectory: "/plugins",
		communityPluginsEnabled: true,
		onReload: vi.fn().mockResolvedValue(undefined),
		onInstall: vi.fn().mockResolvedValue(undefined),
		onToggleEnabled: vi.fn().mockResolvedValue(undefined),
		onUninstall: vi.fn().mockResolvedValue(undefined),
		onCommunityPluginsEnabledChange: vi.fn().mockResolvedValue(undefined),
		...props,
	};

	const result = render(
		<DialogProvider>
			<PluginsSection ref={null} {...mergedProps} />
		</DialogProvider>,
	);
	return { ...result, props: mergedProps };
}

describe("PluginsSection", () => {
	it("renders plugins and statuses", () => {
		renderSection();

		expect(screen.getByText("Good Plugin")).toBeInTheDocument();
		expect(screen.getByText("Bad Plugin")).toBeInTheDocument();
		expect(screen.getByText("OK")).toBeInTheDocument();
		expect(screen.getByText("Incompatible API")).toBeInTheDocument();
		expect(screen.getByText("api_version: api mismatch")).toBeInTheDocument();
		expect(screen.getByText("isolation trusted_builtin | executable yes")).toBeInTheDocument();
		expect(screen.getByText("isolation quarantined_local | executable no")).toBeInTheDocument();
	});

	it("calls install and reload actions", async () => {
		const { props } = renderSection();

		fireEvent.click(screen.getByRole("button", { name: "Install Plugin" }));
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

		await waitFor(() => {
			expect(props.onInstall).toHaveBeenCalledTimes(1);
			expect(props.onReload).toHaveBeenCalledTimes(1);
		});
	});

	it("disables toggle for non-operational plugins", () => {
		renderSection();
		const toggles = screen.getAllByRole("switch");
		expect(toggles).toHaveLength(3);
		expect(toggles[2]).toBeDisabled();
	});

	it("confirms uninstall before calling callback", async () => {
		const { props } = renderSection();

		fireEvent.click(screen.getAllByRole("button", { name: "Uninstall" })[0]);
		expect(screen.getByText("Uninstall Plugin?")).toBeInTheDocument();
		const uninstallButtons = screen.getAllByRole("button", { name: "Uninstall" });
		fireEvent.click(uninstallButtons[uninstallButtons.length - 1]);

		await waitFor(() => {
			expect(props.onUninstall).toHaveBeenCalledWith("good.plugin");
		});
	});
});

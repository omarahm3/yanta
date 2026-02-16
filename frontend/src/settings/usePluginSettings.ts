import { useCallback, useEffect, useState } from "react";
import type { InstallRecord, ValidationIssue } from "../../bindings/yanta/internal/plugins/models";
import {
	GetCommunityPluginsEnabled,
	GetPluginDirectory,
	InstallFromDirectory,
	ListInstalled,
	SetCommunityPluginsEnabled,
	SetPluginEnabled,
	Uninstall,
} from "../../bindings/yanta/internal/plugins/wailsservice";
import { OpenDirectoryDialogWithTitle } from "../../bindings/yanta/internal/system/service";
import { useNotification } from "../shared/hooks";

export type PluginInstallRecord = InstallRecord & {
	status?: string;
	issues?: ValidationIssue[];
};

function toErrorMessage(err: unknown): string {
	const raw = String(err ?? "").replace(/^Error:\s*/, "");

	if (raw.startsWith("PLUGIN_ALREADY_INSTALLED:")) {
		return raw.replace("PLUGIN_ALREADY_INSTALLED:", "Already installed:").trim();
	}
	if (raw.startsWith("PLUGIN_INVALID_MANIFEST:")) {
		return raw.replace("PLUGIN_INVALID_MANIFEST:", "Invalid plugin manifest:").trim();
	}
	if (raw.startsWith("PLUGIN_INCOMPATIBLE_API:")) {
		return raw
			.replace("PLUGIN_INCOMPATIBLE_API:", "Plugin API is not compatible with this Yanta version:")
			.trim();
	}
	if (raw.startsWith("PLUGIN_NOT_INSTALLED:")) {
		return raw.replace("PLUGIN_NOT_INSTALLED:", "Plugin not installed:").trim();
	}
	if (raw.startsWith("PLUGIN_NOT_OPERATIONAL:")) {
		return raw.replace("PLUGIN_NOT_OPERATIONAL:", "Plugin cannot be toggled:").trim();
	}
	if (raw.startsWith("PLUGIN_BAD_SOURCE:")) {
		return raw.replace("PLUGIN_BAD_SOURCE:", "Invalid plugin source:").trim();
	}
	if (raw.startsWith("PLUGIN_BUILD_METADATA_MISSING:")) {
		return raw
			.replace(
				"PLUGIN_BUILD_METADATA_MISSING:",
				"Plugin build metadata is missing. Rebuild with `yanta-plugin build`:",
			)
			.trim();
	}
	if (raw.startsWith("PLUGIN_BUILD_METADATA_INVALID:")) {
		return raw
			.replace(
				"PLUGIN_BUILD_METADATA_INVALID:",
				"Plugin build metadata is invalid. Rebuild with `yanta-plugin build`:",
			)
			.trim();
	}
	if (raw.startsWith("PLUGIN_BUILD_HASH_MISMATCH:")) {
		return raw
			.replace(
				"PLUGIN_BUILD_HASH_MISMATCH:",
				"Plugin bundle hash mismatch. Rebuild with `yanta-plugin build`:",
			)
			.trim();
	}
	if (raw.startsWith("PLUGIN_FORBIDDEN_BUNDLE:")) {
		return raw
			.replace(
				"PLUGIN_FORBIDDEN_BUNDLE:",
				"Plugin bundles forbidden host runtime dependencies. Externalize them via `yanta-plugin build`:",
			)
			.trim();
	}
	if (raw.startsWith("PLUGIN_SANDBOX_RESTRICTED:")) {
		return raw.replace("PLUGIN_SANDBOX_RESTRICTED:", "Plugin cannot execute:").trim();
	}
	return raw || "Plugin operation failed";
}

export function usePluginSettings(pluginFeatureEnabled = true) {
	const [plugins, setPlugins] = useState<PluginInstallRecord[]>([]);
	const [isLoading, setIsLoading] = useState(pluginFeatureEnabled);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [pluginDirectory, setPluginDirectory] = useState("");
	const [communityPluginsEnabled, setCommunityPluginsEnabledState] = useState(false);
	const { success, error } = useNotification();

	const reload = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const records = await ListInstalled();
			setPlugins(Array.isArray(records) ? (records as PluginInstallRecord[]) : []);
		} catch (err) {
			setErrorMessage(toErrorMessage(err));
		} finally {
			setIsLoading(false);
		}
	}, []);

	const loadPluginDirectory = useCallback(async () => {
		try {
			const directory = await GetPluginDirectory();
			setPluginDirectory(directory ?? "");
		} catch {
			setPluginDirectory("");
		}
	}, []);

	const loadCommunityMode = useCallback(async () => {
		try {
			const enabled = await GetCommunityPluginsEnabled();
			setCommunityPluginsEnabledState(Boolean(enabled));
		} catch {
			setCommunityPluginsEnabledState(false);
		}
	}, []);

	useEffect(() => {
		if (!pluginFeatureEnabled) {
			setPlugins([]);
			setErrorMessage(null);
			setPluginDirectory("");
			setCommunityPluginsEnabledState(false);
			setIsLoading(false);
			return;
		}
		void reload();
		void loadPluginDirectory();
		void loadCommunityMode();
	}, [pluginFeatureEnabled, reload, loadPluginDirectory, loadCommunityMode]);

	const installPlugin = useCallback(async () => {
		if (!pluginFeatureEnabled) return;
		try {
			const selected = await OpenDirectoryDialogWithTitle("Select Plugin Directory");
			if (!selected) return;
			await InstallFromDirectory(selected);
			success("Plugin installed");
			await reload();
		} catch (err) {
			error(toErrorMessage(err));
		}
	}, [pluginFeatureEnabled, error, reload, success]);

	const setPluginEnabled = useCallback(
		async (pluginId: string, nextEnabled: boolean) => {
			if (!pluginFeatureEnabled) return;
			try {
				await SetPluginEnabled(pluginId, nextEnabled);
				setPlugins((prev) =>
					prev.map((plugin) =>
						plugin.manifest.ID === pluginId ? { ...plugin, enabled: nextEnabled } : plugin,
					),
				);
			} catch (err) {
				error(toErrorMessage(err));
			}
		},
		[pluginFeatureEnabled, error],
	);

	const uninstallPlugin = useCallback(
		async (pluginId: string) => {
			if (!pluginFeatureEnabled) return;
			try {
				await Uninstall(pluginId);
				success("Plugin uninstalled");
				await reload();
			} catch (err) {
				error(toErrorMessage(err));
			}
		},
		[pluginFeatureEnabled, error, reload, success],
	);

	const setCommunityPluginsEnabled = useCallback(
		async (enabled: boolean) => {
			if (!pluginFeatureEnabled) return;
			try {
				await SetCommunityPluginsEnabled(enabled);
				setCommunityPluginsEnabledState(enabled);
				await reload();
			} catch (err) {
				error(toErrorMessage(err));
			}
		},
		[pluginFeatureEnabled, error, reload],
	);

	return {
		plugins,
		isLoading,
		errorMessage,
		pluginDirectory,
		communityPluginsEnabled,
		reload,
		installPlugin,
		setPluginEnabled,
		uninstallPlugin,
		setCommunityPluginsEnabled,
	};
}

import { useCallback, useEffect, useState } from "react";
import type { Status } from "../../bindings/yanta/internal/mcpctl/models";
import {
	GetStatus,
	RegenerateToken,
	SetEnabled,
	SetPort,
} from "../../bindings/yanta/internal/mcpctl/service";
import { useNotification } from "../shared/hooks";
import { BackendLogger } from "../shared/utils/backendLogger";

export function useMcpSettings() {
	const [status, setStatus] = useState<Status | null>(null);
	const [busy, setBusy] = useState(false);
	const { success, error } = useNotification();

	const refresh = useCallback(() => {
		GetStatus()
			.then(setStatus)
			.catch((err) => BackendLogger.error("Failed to get MCP status:", err));
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const setEnabled = useCallback(
		async (enabled: boolean) => {
			setBusy(true);
			try {
				const next = await SetEnabled(enabled);
				setStatus(next);
				success(enabled ? "MCP server started" : "MCP server stopped");
			} catch (err) {
				error(`Failed to ${enabled ? "start" : "stop"} the MCP server: ${err}`);
				refresh();
			} finally {
				setBusy(false);
			}
		},
		[success, error, refresh],
	);

	const setPort = useCallback(
		async (port: number) => {
			setBusy(true);
			try {
				setStatus(await SetPort(port));
			} catch (err) {
				error(`Failed to change the MCP port: ${err}`);
				refresh();
			} finally {
				setBusy(false);
			}
		},
		[error, refresh],
	);

	const regenerateToken = useCallback(async () => {
		setBusy(true);
		try {
			setStatus(await RegenerateToken());
			success("Generated a new MCP token");
		} catch (err) {
			error(`Failed to regenerate the MCP token: ${err}`);
			refresh();
		} finally {
			setBusy(false);
		}
	}, [success, error, refresh]);

	return { status, busy, setEnabled, setPort, regenerateToken };
}

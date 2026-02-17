import { useEffect, useMemo, useState } from "react";
import { useFeatureFlag } from "../shared/hooks";
import {
	type AppMonitorSnapshot,
	getAppMonitorSnapshot,
	startAppMonitor,
} from "../shared/monitoring/appMonitor";

function formatMb(bytes: number | null): string {
	if (bytes === null) {
		return "n/a";
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPercent(value: number, total: number): string {
	if (total <= 0) return "n/a";
	return `${((value / total) * 100).toFixed(1)}%`;
}

export function AppMonitorInit() {
	const { enabled: appMonitorEnabled, isLoading: featureFlagLoading } = useFeatureFlag("appMonitor");
	const [snapshot, setSnapshot] = useState<AppMonitorSnapshot>(() => getAppMonitorSnapshot());

	useEffect(() => {
		if (featureFlagLoading || !appMonitorEnabled) return;
		const stop = startAppMonitor();
		const timer = setInterval(() => {
			setSnapshot(getAppMonitorSnapshot());
		}, 2000);
		return () => {
			clearInterval(timer);
			stop();
		};
	}, [featureFlagLoading, appMonitorEnabled]);

	const heapSummary = useMemo(() => {
		const used = snapshot.lastSample?.heapUsedBytes ?? null;
		const total = snapshot.lastSample?.heapTotalBytes ?? null;
		if (used === null || total === null) {
			return "Heap: n/a";
		}
		return `Heap: ${formatMb(used)} / ${formatMb(total)} (${formatPercent(used, total)})`;
	}, [snapshot.lastSample?.heapTotalBytes, snapshot.lastSample?.heapUsedBytes]);

	if (featureFlagLoading || !appMonitorEnabled) {
		return null;
	}

	return (
		<div className="fixed top-3 right-3 z-[9999] rounded border border-border-subtle bg-overlay/90 px-3 py-2 text-xs leading-tight text-text-dim shadow-lg backdrop-blur">
			<div className="font-medium text-text-bright">App Monitor</div>
			<div>{heapSummary}</div>
			<div>
				DocGet: {snapshot.documentGetCalls} calls, {snapshot.documentGetErrors} errors, in-flight{" "}
				{snapshot.documentGetInFlight}, avg {snapshot.documentGetAvgMs.toFixed(1)}ms
			</div>
			<div>
				GitOps: sync {snapshot.inFlightCommands.syncNow}, pull {snapshot.inFlightCommands.gitPull},
				status {snapshot.inFlightCommands.gitStatus}
			</div>
			<div>Pending logs: {snapshot.pendingBackendLogs}</div>
			<div>Samples: {snapshot.samples.length}</div>
		</div>
	);
}

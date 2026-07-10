import { useEffect, useRef } from "react";
import { useSyncStore } from "../stores/sync.store";
import { useToast } from "./Toast";

const SYNC_TOAST_ID = "git-sync-in-progress";

export const SyncToast: React.FC = () => {
	const inProgress = useSyncStore((s) => s.inProgress);
	const toast = useToast();
	const toastIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (inProgress) {
			toastIdRef.current = toast.info("Syncing…", {
				id: SYNC_TOAST_ID,
				duration: 0,
			});
		} else if (toastIdRef.current) {
			toast.dismiss(toastIdRef.current);
			toastIdRef.current = null;
		}
	}, [inProgress, toast]);

	return null;
};

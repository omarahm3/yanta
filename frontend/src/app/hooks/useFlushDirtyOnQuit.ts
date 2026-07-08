import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { flushAllDirty } from "../../shared/hooks/useAutoSave";

export function useFlushDirtyOnQuit(): void {
	useEffect(() => {
		const unsubscribe = Events.On("yanta/app/flush-dirty", async () => {
			await flushAllDirty();
			Events.Emit("yanta/app/flush-dirty:ack");
		});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, []);
}

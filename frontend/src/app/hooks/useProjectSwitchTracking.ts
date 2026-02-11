import { useEffect, useRef } from "react";
import { useProjectContext, useUserProgressContext } from "../../contexts";

export function useProjectSwitchTracking(): void {
	const { currentProject } = useProjectContext();
	const { incrementProjectsSwitched } = useUserProgressContext();
	const previousProjectIdRef = useRef<string | undefined>(undefined);
	const isFirstRenderRef = useRef(true);

	useEffect(() => {
		const currentId = currentProject?.id;
		const previousId = previousProjectIdRef.current;

		if (isFirstRenderRef.current) {
			isFirstRenderRef.current = false;
			previousProjectIdRef.current = currentId;
			return;
		}

		if (currentId && previousId && currentId !== previousId) {
			incrementProjectsSwitched();
		}

		previousProjectIdRef.current = currentId;
	}, [currentProject?.id, incrementProjectsSwitched]);
}

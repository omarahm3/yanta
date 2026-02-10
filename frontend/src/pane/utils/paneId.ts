let paneIdCounter = 0;

export function generatePaneId(): string {
	paneIdCounter += 1;
	return `pane-${Date.now()}-${paneIdCounter}`;
}

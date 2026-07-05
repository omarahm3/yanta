import { beforeEach, describe, expect, it } from "vitest";
import { useErrorDialogStore } from "../errorDialog.store";

describe("errorDialog store", () => {
	beforeEach(() => {
		useErrorDialogStore.getState().reset();
	});

	it("enqueues errors and dismisses them FIFO", () => {
		const { showError } = useErrorDialogStore.getState();
		showError("REBASE_CONFLICT: a");
		showError(new Error("boom"));

		expect(useErrorDialogStore.getState().queue).toHaveLength(2);

		useErrorDialogStore.getState().dismiss();
		const queue = useErrorDialogStore.getState().queue;
		expect(queue).toHaveLength(1);
		expect(queue[0].technicalDetails).toContain("boom");
	});

	it("collapses consecutive duplicate errors so retries don't stack", () => {
		const { showError } = useErrorDialogStore.getState();
		showError("same error text");
		showError("same error text");

		expect(useErrorDialogStore.getState().queue).toHaveLength(1);
	});
});

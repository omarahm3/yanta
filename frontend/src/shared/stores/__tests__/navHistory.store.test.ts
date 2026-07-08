import { beforeEach, describe, expect, it } from "vitest";
import { selectCanGoBack, selectCanGoForward, useNavHistoryStore } from "../navHistory.store";

describe("navHistory.store", () => {
	beforeEach(() => {
		useNavHistoryStore.setState({ index: 0, maxIndex: 0 });
	});

	it("starts with no back/forward available", () => {
		const s = useNavHistoryStore.getState();
		expect(selectCanGoBack(s)).toBe(false);
		expect(selectCanGoForward(s)).toBe(false);
	});

	it("recordPush advances the index and returns it", () => {
		expect(useNavHistoryStore.getState().recordPush()).toBe(1);
		expect(useNavHistoryStore.getState().recordPush()).toBe(2);
		const s = useNavHistoryStore.getState();
		expect(s.index).toBe(2);
		expect(s.maxIndex).toBe(2);
		expect(selectCanGoBack(s)).toBe(true);
		expect(selectCanGoForward(s)).toBe(false);
	});

	it("recordPopTo enables forward when moving back within the frontier", () => {
		useNavHistoryStore.getState().recordPush();
		useNavHistoryStore.getState().recordPush(); // index 2, max 2
		useNavHistoryStore.getState().recordPopTo(1); // step back to 1

		const s = useNavHistoryStore.getState();
		expect(s.index).toBe(1);
		expect(s.maxIndex).toBe(2);
		expect(selectCanGoBack(s)).toBe(true);
		expect(selectCanGoForward(s)).toBe(true);
	});

	it("a new push after going back truncates the forward frontier", () => {
		useNavHistoryStore.getState().recordPush();
		useNavHistoryStore.getState().recordPush(); // index 2, max 2
		useNavHistoryStore.getState().recordPopTo(1); // back to 1
		useNavHistoryStore.getState().recordPush(); // new branch -> index 2, max 2

		const s = useNavHistoryStore.getState();
		expect(s.index).toBe(2);
		expect(s.maxIndex).toBe(2);
		expect(selectCanGoForward(s)).toBe(false);
	});

	it("recordPopTo(0) returns to the initial entry with no back available", () => {
		useNavHistoryStore.getState().recordPush();
		useNavHistoryStore.getState().recordPopTo(0);
		const s = useNavHistoryStore.getState();
		expect(selectCanGoBack(s)).toBe(false);
		expect(selectCanGoForward(s)).toBe(true);
	});
});

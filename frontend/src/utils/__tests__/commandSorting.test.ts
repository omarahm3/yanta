import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	sortCommandsByUsage,
	getRecentlyUsedCommands,
	isRecentlyUsed,
} from "../commandSorting";
import type { CommandUsageRecord } from "../../hooks/useCommandUsage";
import type { CommandOption } from "../../components/ui/CommandPalette";

// Helper to create a mock command
function createCommand(id: string, group?: string): CommandOption {
	return {
		id,
		icon: null,
		text: `Command ${id}`,
		group,
		action: vi.fn(),
	};
}

// Time constants for tests (matching the source)
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

describe("sortCommandsByUsage", () => {
	const now = 1700000000000; // Fixed timestamp for testing

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns commands in original order when no usage data exists", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
			createCommand("cmd-c"),
		];
		const usage: CommandUsageRecord = {};

		const sorted = sortCommandsByUsage(commands, usage);

		expect(sorted.map((c) => c.id)).toEqual(["cmd-a", "cmd-b", "cmd-c"]);
	});

	it("boosts recently used commands to the top", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
			createCommand("cmd-c"),
		];
		const usage: CommandUsageRecord = {
			"cmd-c": { lastUsed: now - 5 * 60 * 1000, useCount: 1 }, // 5 minutes ago
		};

		const sorted = sortCommandsByUsage(commands, usage);

		expect(sorted[0].id).toBe("cmd-c");
	});

	it("prioritizes more recently used commands over older ones", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
			createCommand("cmd-c"),
		];
		const usage: CommandUsageRecord = {
			"cmd-a": { lastUsed: now - 2 * DAY_MS, useCount: 1 }, // 2 days ago
			"cmd-b": { lastUsed: now - 30 * 60 * 1000, useCount: 1 }, // 30 minutes ago
			"cmd-c": { lastUsed: now - 5 * HOUR_MS, useCount: 1 }, // 5 hours ago
		};

		const sorted = sortCommandsByUsage(commands, usage);

		// cmd-b is most recent (within hour), then cmd-c (within day), then cmd-a (older)
		expect(sorted.map((c) => c.id)).toEqual(["cmd-b", "cmd-c", "cmd-a"]);
	});

	it("factors in frequency when recency is similar", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
		];
		const usage: CommandUsageRecord = {
			// Both used within the same time bracket (last hour)
			"cmd-a": { lastUsed: now - 10 * 60 * 1000, useCount: 2 },
			"cmd-b": { lastUsed: now - 10 * 60 * 1000, useCount: 10 },
		};

		const sorted = sortCommandsByUsage(commands, usage);

		// cmd-b has higher frequency, so it should be first
		expect(sorted[0].id).toBe("cmd-b");
	});

	it("caps frequency boost to prevent domination", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
		];
		const usage: CommandUsageRecord = {
			// cmd-a: used recently with moderate frequency
			"cmd-a": { lastUsed: now - 5 * 60 * 1000, useCount: 5 },
			// cmd-b: used long ago with very high frequency
			"cmd-b": { lastUsed: now - 2 * WEEK_MS, useCount: 1000 },
		};

		const sorted = sortCommandsByUsage(commands, usage);

		// cmd-a should still win due to recency despite lower frequency
		expect(sorted[0].id).toBe("cmd-a");
	});

	it("preserves original order for commands with equal scores", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
			createCommand("cmd-c"),
		];
		// All commands have equal usage data
		const usage: CommandUsageRecord = {
			"cmd-a": { lastUsed: now - 5 * 60 * 1000, useCount: 3 },
			"cmd-b": { lastUsed: now - 5 * 60 * 1000, useCount: 3 },
			"cmd-c": { lastUsed: now - 5 * 60 * 1000, useCount: 3 },
		};

		const sorted = sortCommandsByUsage(commands, usage);

		// Order should be preserved since scores are identical
		expect(sorted.map((c) => c.id)).toEqual(["cmd-a", "cmd-b", "cmd-c"]);
	});

	it("does not mutate the original commands array", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
		];
		const originalOrder = [...commands];
		const usage: CommandUsageRecord = {
			"cmd-b": { lastUsed: now - 5 * 60 * 1000, useCount: 1 },
		};

		sortCommandsByUsage(commands, usage);

		expect(commands).toEqual(originalOrder);
	});

	it("handles empty commands array", () => {
		const commands: CommandOption[] = [];
		const usage: CommandUsageRecord = {
			"cmd-a": { lastUsed: now - 5 * 60 * 1000, useCount: 1 },
		};

		const sorted = sortCommandsByUsage(commands, usage);

		expect(sorted).toEqual([]);
	});

	it("handles commands with mixed usage data (some with, some without)", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
			createCommand("cmd-c"),
		];
		const usage: CommandUsageRecord = {
			"cmd-b": { lastUsed: now - 5 * 60 * 1000, useCount: 1 },
		};

		const sorted = sortCommandsByUsage(commands, usage);

		// cmd-b should be first (has usage), then cmd-a and cmd-c in original order
		expect(sorted[0].id).toBe("cmd-b");
		expect(sorted[1].id).toBe("cmd-a");
		expect(sorted[2].id).toBe("cmd-c");
	});
});

describe("getRecentlyUsedCommands", () => {
	const now = 1700000000000;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns empty array when no commands have usage data", () => {
		const commands = [createCommand("cmd-a"), createCommand("cmd-b")];
		const usage: CommandUsageRecord = {};

		const recent = getRecentlyUsedCommands(commands, usage);

		expect(recent).toEqual([]);
	});

	it("returns commands used within the last week", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
			createCommand("cmd-c"),
		];
		const usage: CommandUsageRecord = {
			"cmd-a": { lastUsed: now - 2 * DAY_MS, useCount: 1 }, // 2 days ago (include)
			"cmd-b": { lastUsed: now - 2 * WEEK_MS, useCount: 1 }, // 2 weeks ago (exclude)
			"cmd-c": { lastUsed: now - HOUR_MS, useCount: 1 }, // 1 hour ago (include)
		};

		const recent = getRecentlyUsedCommands(commands, usage);

		expect(recent.map((c) => c.id)).toContain("cmd-a");
		expect(recent.map((c) => c.id)).toContain("cmd-c");
		expect(recent.map((c) => c.id)).not.toContain("cmd-b");
	});

	it("sorts by most recently used first", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
			createCommand("cmd-c"),
		];
		const usage: CommandUsageRecord = {
			"cmd-a": { lastUsed: now - 3 * DAY_MS, useCount: 1 },
			"cmd-b": { lastUsed: now - HOUR_MS, useCount: 1 },
			"cmd-c": { lastUsed: now - DAY_MS, useCount: 1 },
		};

		const recent = getRecentlyUsedCommands(commands, usage);

		expect(recent.map((c) => c.id)).toEqual(["cmd-b", "cmd-c", "cmd-a"]);
	});

	it("respects the limit parameter", () => {
		const commands = [
			createCommand("cmd-a"),
			createCommand("cmd-b"),
			createCommand("cmd-c"),
			createCommand("cmd-d"),
			createCommand("cmd-e"),
		];
		const usage: CommandUsageRecord = {
			"cmd-a": { lastUsed: now - HOUR_MS, useCount: 1 },
			"cmd-b": { lastUsed: now - 2 * HOUR_MS, useCount: 1 },
			"cmd-c": { lastUsed: now - 3 * HOUR_MS, useCount: 1 },
			"cmd-d": { lastUsed: now - 4 * HOUR_MS, useCount: 1 },
			"cmd-e": { lastUsed: now - 5 * HOUR_MS, useCount: 1 },
		};

		const recent = getRecentlyUsedCommands(commands, usage, 3);

		expect(recent).toHaveLength(3);
		expect(recent.map((c) => c.id)).toEqual(["cmd-a", "cmd-b", "cmd-c"]);
	});

	it("uses default limit of 5", () => {
		const commands = Array.from({ length: 10 }, (_, i) =>
			createCommand(`cmd-${i}`),
		);
		const usage: CommandUsageRecord = {};
		commands.forEach((cmd, i) => {
			usage[cmd.id] = { lastUsed: now - i * HOUR_MS, useCount: 1 };
		});

		const recent = getRecentlyUsedCommands(commands, usage);

		expect(recent).toHaveLength(5);
	});
});

describe("isRecentlyUsed", () => {
	const now = 1700000000000;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns false when command has no usage data", () => {
		const usage: CommandUsageRecord = {};

		expect(isRecentlyUsed("cmd-a", usage)).toBe(false);
	});

	it("returns true when command was used within the last hour", () => {
		const usage: CommandUsageRecord = {
			"cmd-a": { lastUsed: now - 30 * 60 * 1000, useCount: 1 }, // 30 minutes ago
		};

		expect(isRecentlyUsed("cmd-a", usage)).toBe(true);
	});

	it("returns false when command was used more than an hour ago", () => {
		const usage: CommandUsageRecord = {
			"cmd-a": { lastUsed: now - 2 * HOUR_MS, useCount: 1 }, // 2 hours ago
		};

		expect(isRecentlyUsed("cmd-a", usage)).toBe(false);
	});

	it("returns true for command used exactly at the edge of the hour", () => {
		const usage: CommandUsageRecord = {
			"cmd-a": { lastUsed: now - HOUR_MS + 1000, useCount: 1 }, // Just under 1 hour
		};

		expect(isRecentlyUsed("cmd-a", usage)).toBe(true);
	});

	it("returns false for command used exactly 1 hour ago", () => {
		const usage: CommandUsageRecord = {
			"cmd-a": { lastUsed: now - HOUR_MS, useCount: 1 }, // Exactly 1 hour
		};

		expect(isRecentlyUsed("cmd-a", usage)).toBe(false);
	});
});

import { describe, expect, it } from "vitest";
import { featureFlagsFromModel } from "../featureFlags";

describe("featureFlagsFromModel", () => {
	it("maps backend PascalCase keys to frontend camelCase", () => {
		const result = featureFlagsFromModel({
			TooltipHints: true,
			AppMonitor: true,
			CommandLine: false,
		});

		expect(result).toEqual({
			tooltipHints: true,
			appMonitor: true,
			commandLine: false,
		});
	});

	it("falls back to defaults when fields are missing", () => {
		const result = featureFlagsFromModel({});
		expect(typeof result.tooltipHints).toBe("boolean");
		expect(typeof result.appMonitor).toBe("boolean");
		expect(typeof result.commandLine).toBe("boolean");
	});
});

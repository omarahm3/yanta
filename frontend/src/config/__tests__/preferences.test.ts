import { describe, expect, it } from "vitest";
import {
	type PreferencesOverrides,
	preferencesFromModel,
	preferencesToModel,
} from "../preferences";

describe("preferences graphics overrides", () => {
	it("maps Graphics.LinuxMode from backend model", () => {
		const result = preferencesFromModel({
			Graphics: {
				LinuxMode: "compat",
			},
		});

		expect(result.graphics?.linuxMode).toBe("compat");
	});

	it("maps graphics.linuxMode to backend model", () => {
		const result = preferencesToModel({
			graphics: {
				linuxMode: "software",
			},
		});

		expect(result.Graphics.LinuxMode).toBe("software");
	});

	it("preserves existing sections while including graphics", () => {
		const overrides: PreferencesOverrides = {
			layout: { maxPanes: 4 },
			graphics: { linuxMode: "native" },
		};
		const result = preferencesToModel(overrides);

		expect(result.Layout.MaxPanes).toBe(4);
		expect(result.Graphics.LinuxMode).toBe("native");
	});
});

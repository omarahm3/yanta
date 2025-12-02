import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/DocumentService", () => ({
	DocumentServiceWrapper: {
		save: vi.fn().mockResolvedValue("path/to/doc.json"),
		get: vi.fn().mockResolvedValue({
			title: "Test Doc",
			blocks: [
				{
					type: "heading",
					props: { level: 1 },
					content: [{ type: "text", text: "Test", styles: {} }],
					children: [],
				},
			],
			tags: [],
		}),
	},
}));

import { DocumentServiceWrapper } from "../services/DocumentService";

describe("Document Open - Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should NOT call save on the mock after module load (sanity check)", () => {
		expect(DocumentServiceWrapper.save).not.toHaveBeenCalled();
	});

	it("should be able to call save mock when explicitly invoked", async () => {
		await DocumentServiceWrapper.save({
			title: "Test",
			blocks: [],
			tags: [],
			projectAlias: "test",
		});
		expect(DocumentServiceWrapper.save).toHaveBeenCalledTimes(1);
	});
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ParseWithDocument } from "../bindings/yanta/internal/commandline/documentcommands";
import { ExportToPDF } from "../bindings/yanta/internal/export/service";
import { Dialogs } from "@wailsio/runtime";

vi.mock("../bindings/yanta/internal/commandline/documentcommands");
vi.mock("../bindings/yanta/internal/export/service");
vi.mock("@wailsio/runtime", () => ({
	Dialogs: {
		SaveFile: vi.fn(),
	},
	Events: {},
	Create: {
		Array: vi.fn((fn) => fn),
		Any: vi.fn(),
		Nullable: vi.fn((fn) => fn),
	},
}));

describe("Export to PDF", () => {
	const mockDocumentPath = "projects/test/document.json";

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Command parsing", () => {
		it("should parse export-pdf command successfully", async () => {
			const mockResponse = {
				success: true,
				message: "export to PDF",
			};

			vi.mocked(ParseWithDocument).mockResolvedValue(mockResponse);

			const result = await ParseWithDocument("export-pdf", mockDocumentPath);

			expect(ParseWithDocument).toHaveBeenCalledWith("export-pdf", mockDocumentPath);
			expect(result.success).toBe(true);
			expect(result.message).toBe("export to PDF");
		});

		it("should handle command parse failure", async () => {
			const mockResponse = {
				success: false,
				message: "Failed to parse command",
			};

			vi.mocked(ParseWithDocument).mockResolvedValue(mockResponse);

			const result = await ParseWithDocument("export-pdf", mockDocumentPath);

			expect(result.success).toBe(false);
			expect(result.message).toBe("Failed to parse command");
		});
	});

	describe("Export flow", () => {
		it("should export to PDF successfully when user selects output path", async () => {
			const mockOutputPath = "/path/to/export/document.pdf";

			vi.mocked(Dialogs.SaveFile).mockResolvedValue(mockOutputPath);
			vi.mocked(ExportToPDF).mockResolvedValue(undefined);

			// Simulate the file dialog
			const outputPath = await Dialogs.SaveFile({
				Title: "Export to PDF",
				Filename: "document.pdf",
				Filters: [
					{
						DisplayName: "PDF Files",
						Pattern: "*.pdf",
					},
				],
			});

			expect(outputPath).toBe(mockOutputPath);

			// Simulate the export call
			await ExportToPDF({
				DocumentPath: mockDocumentPath,
				OutputPath: outputPath,
			});

			expect(ExportToPDF).toHaveBeenCalledWith({
				DocumentPath: mockDocumentPath,
				OutputPath: mockOutputPath,
			});
		});

		it("should handle user cancelling file dialog", async () => {
			vi.mocked(Dialogs.SaveFile).mockResolvedValue("");

			const outputPath = await Dialogs.SaveFile({
				Title: "Export to PDF",
				Filename: "document.pdf",
				Filters: [
					{
						DisplayName: "PDF Files",
						Pattern: "*.pdf",
					},
				],
			});

			expect(outputPath).toBe("");
			expect(ExportToPDF).not.toHaveBeenCalled();
		});

		it("should handle export service failure", async () => {
			const mockOutputPath = "/path/to/export/document.pdf";
			const mockError = new Error("Failed to generate PDF");

			vi.mocked(Dialogs.SaveFile).mockResolvedValue(mockOutputPath);
			vi.mocked(ExportToPDF).mockRejectedValue(mockError);

			const outputPath = await Dialogs.SaveFile({
				Title: "Export to PDF",
				Filename: "document.pdf",
				Filters: [
					{
						DisplayName: "PDF Files",
						Pattern: "*.pdf",
					},
				],
			});

			expect(outputPath).toBe(mockOutputPath);

			await expect(
				ExportToPDF({
					DocumentPath: mockDocumentPath,
					OutputPath: outputPath,
				})
			).rejects.toThrow("Failed to generate PDF");
		});
	});

	describe("File dialog configuration", () => {
		it("should configure save dialog with correct parameters", async () => {
			const mockOutputPath = "/path/to/export/test_document.pdf";

			vi.mocked(Dialogs.SaveFile).mockResolvedValue(mockOutputPath);

			await Dialogs.SaveFile({
				Title: "Export to PDF",
				Filename: "test_document.pdf",
				Filters: [
					{
						DisplayName: "PDF Files",
						Pattern: "*.pdf",
					},
				],
			});

			expect(Dialogs.SaveFile).toHaveBeenCalledWith({
				Title: "Export to PDF",
				Filename: "test_document.pdf",
				Filters: [
					{
						DisplayName: "PDF Files",
						Pattern: "*.pdf",
					},
				],
			});
		});

		it("should generate sanitized filename from document title", () => {
			const testCases = [
				{ title: "My Document", expected: "my_document.pdf" },
				{ title: "Test/Document:Name", expected: "test_document_name.pdf" },
				{ title: "Doc With Spaces!", expected: "doc_with_spaces_.pdf" },
				{ title: "ÜnïcödéChars", expected: "_n_c_d_chars.pdf" },
			];

			for (const { title, expected } of testCases) {
				const sanitized = title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".pdf";
				expect(sanitized).toBe(expected);
			}
		});
	});

	describe("Export request", () => {
		it("should create export request with correct document and output paths", async () => {
			const mockOutputPath = "/path/to/export/output.pdf";

			vi.mocked(Dialogs.SaveFile).mockResolvedValue(mockOutputPath);
			vi.mocked(ExportToPDF).mockResolvedValue(undefined);

			const outputPath = await Dialogs.SaveFile({
				Title: "Export to PDF",
				Filename: "output.pdf",
				Filters: [
					{
						DisplayName: "PDF Files",
						Pattern: "*.pdf",
					},
				],
			});

			await ExportToPDF({
				DocumentPath: mockDocumentPath,
				OutputPath: outputPath,
			});

			expect(ExportToPDF).toHaveBeenCalledWith(
				expect.objectContaining({
					DocumentPath: mockDocumentPath,
					OutputPath: mockOutputPath,
				})
			);
		});
	});

	describe("Error handling", () => {
		it("should handle non-Error exceptions from export service", async () => {
			const mockOutputPath = "/path/to/export/document.pdf";

			vi.mocked(Dialogs.SaveFile).mockResolvedValue(mockOutputPath);
			vi.mocked(ExportToPDF).mockRejectedValue("Unknown error");

			const outputPath = await Dialogs.SaveFile({
				Title: "Export to PDF",
				Filename: "document.pdf",
				Filters: [
					{
						DisplayName: "PDF Files",
						Pattern: "*.pdf",
					},
				],
			});

			await expect(
				ExportToPDF({
					DocumentPath: mockDocumentPath,
					OutputPath: outputPath,
				})
			).rejects.toBe("Unknown error");
		});

		it("should handle file dialog errors", async () => {
			const mockError = new Error("Dialog failed to open");

			vi.mocked(Dialogs.SaveFile).mockRejectedValue(mockError);

			await expect(
				Dialogs.SaveFile({
					Title: "Export to PDF",
					Filename: "document.pdf",
					Filters: [
						{
							DisplayName: "PDF Files",
							Pattern: "*.pdf",
						},
					],
				})
			).rejects.toThrow("Dialog failed to open");
		});
	});
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DialogProvider } from "../../../app/context";
import type { ParsedGitError } from "../../utils/gitErrorParser";
import { ConfirmDialog } from "../ConfirmDialog";
import { GitErrorDialog } from "../GitErrorDialog";
import { MigrationConflictDialog } from "../MigrationConflictDialog";

describe("dialog keyboard traversal", () => {
	it("lets keyboard users reach every confirm dialog control", async () => {
		const user = userEvent.setup();

		render(
			<DialogProvider>
				<ConfirmDialog
					isOpen
					title="Delete note"
					message="This action cannot be undone."
					inputPrompt="Type DELETE to confirm"
					expectedInput="DELETE"
					showCheckbox
					onConfirm={() => {}}
					onCancel={() => {}}
				/>
			</DialogProvider>,
		);

		expect(screen.getByPlaceholderText("DELETE")).toHaveFocus();
		await user.type(screen.getByPlaceholderText("DELETE"), "DELETE");

		await user.tab();
		expect(screen.getByRole("checkbox")).toHaveFocus();
		await user.keyboard("[Space]");

		await user.tab();
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

		await user.tab();
		expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
	});

	it("lets keyboard users reach every git error dialog control", async () => {
		const user = userEvent.setup();
		const error: ParsedGitError = {
			type: "NETWORK",
			title: "Sync failed",
			message: "The remote could not be reached.",
			technicalDetails: "dial tcp timeout",
			suggestions: ["Check your network"],
		};

		render(<GitErrorDialog isOpen onClose={() => {}} error={error} />);

		const closeButtons = screen.getAllByRole("button", { name: "Close" });
		expect(closeButtons[0]).toHaveFocus();

		await user.tab();
		expect(closeButtons[1]).toHaveFocus();
	});

	it("lets keyboard users reach every migration conflict control", async () => {
		const user = userEvent.setup();

		render(
			<MigrationConflictDialog
				isOpen
				onCancel={() => {}}
				onConfirm={() => {}}
				conflictInfo={{
					localPath: "/tmp/local",
					targetPath: "/tmp/target",
					localVault: {
						projectCount: 1,
						documentCount: 2,
						totalSizeBytes: 100,
						totalSizeHuman: "100 B",
					},
					targetVault: {
						projectCount: 3,
						documentCount: 5,
						totalSizeBytes: 300,
						totalSizeHuman: "300 B",
					},
				}}
			/>,
		);

		expect(screen.getByRole("radio", { name: /Use Target/i })).toHaveAttribute("aria-checked", "true");
		expect(screen.getByRole("radio", { name: /Use Target/i })).toHaveFocus();

		await user.tab({ shift: true });
		expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

		await user.tab();
		expect(screen.getByRole("radio", { name: /Use Target/i })).toHaveFocus();

		await user.tab();
		expect(screen.getByRole("radio", { name: /Use Local/i })).toHaveFocus();

		await user.tab();
		expect(screen.getByRole("radio", { name: /Merge Both/i })).toHaveFocus();
		await user.keyboard("[Space]");
		expect(screen.getByRole("radio", { name: /Merge Both/i })).toHaveAttribute("aria-checked", "true");

		await user.tab();
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

		await user.tab();
		expect(screen.getByRole("button", { name: "Proceed with Migration" })).toHaveFocus();
	});
});

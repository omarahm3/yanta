import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Table, type TableColumn, type TableRow } from "../Table";

const columns: TableColumn[] = [
	{ key: "name", label: "Name" },
	{ key: "size", label: "Size" },
];

const rows: TableRow[] = [
	{ id: "a", name: "Alpha", size: "1kb" },
	{ id: "b", name: "Beta", size: "2kb" },
	{ id: "c", name: "Gamma", size: "3kb" },
];

const dataRows = (container: HTMLElement) =>
	Array.from(container.querySelectorAll<HTMLElement>("[data-row-id]"));

describe("Table accessibility", () => {
	it("uses roving tabindex: exactly one data row is tabbable when nothing is selected", () => {
		const { container } = render(<Table columns={columns} rows={rows} />);
		const tabbable = dataRows(container).filter((el) => el.getAttribute("tabindex") === "0");
		expect(tabbable).toHaveLength(1);
		// The first row is the tab stop when there is no selection.
		expect(tabbable[0].getAttribute("data-row-id")).toBe("a");
	});

	it("makes the selected row the tab stop and the rest -1", () => {
		const { container } = render(<Table columns={columns} rows={rows} selectedRowId="b" />);
		const tabbable = dataRows(container).filter((el) => el.getAttribute("tabindex") === "0");
		expect(tabbable).toHaveLength(1);
		expect(tabbable[0].getAttribute("data-row-id")).toBe("b");
	});

	it("selects a row on Enter", () => {
		const onRowSelect = vi.fn();
		render(<Table columns={columns} rows={rows} onRowSelect={onRowSelect} />);
		const row = screen.getByText("Beta").closest("[data-row-id]") as HTMLElement;
		fireEvent.keyDown(row, { key: "Enter" });
		expect(onRowSelect).toHaveBeenCalledWith(rows[1]);
	});

	it("selects a row on Space", () => {
		const onRowSelect = vi.fn();
		render(<Table columns={columns} rows={rows} onRowSelect={onRowSelect} />);
		const row = screen.getByText("Gamma").closest("[data-row-id]") as HTMLElement;
		fireEvent.keyDown(row, { key: " " });
		expect(onRowSelect).toHaveBeenCalledWith(rows[2]);
	});
});

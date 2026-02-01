import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "../DatePicker";

describe("DatePicker", () => {
	const today = "2026-01-30";
	const yesterday = "2026-01-29";
	const tomorrow = "2026-01-31";

	it("shows current date", () => {
		render(<DatePicker selectedDate={today} onDateChange={vi.fn()} />);

		expect(screen.getByText(/January 30, 2026/)).toBeInTheDocument();
	});

	it("navigates to previous day", () => {
		const onDateChange = vi.fn();
		render(<DatePicker selectedDate={today} onDateChange={onDateChange} />);

		const prevButton = screen.getByLabelText("Previous day");
		fireEvent.click(prevButton);

		expect(onDateChange).toHaveBeenCalledWith(yesterday);
	});

	it("navigates to next day", () => {
		const onDateChange = vi.fn();
		render(<DatePicker selectedDate={today} onDateChange={onDateChange} />);

		const nextButton = screen.getByLabelText("Next day");
		fireEvent.click(nextButton);

		expect(onDateChange).toHaveBeenCalledWith(tomorrow);
	});

	it("opens calendar on click", () => {
		render(<DatePicker selectedDate={today} onDateChange={vi.fn()} />);

		const dateButton = screen.getByRole("button", { name: /January 30, 2026/ });
		fireEvent.click(dateButton);

		// Calendar should be visible
		expect(screen.getByTestId("calendar-grid")).toBeInTheDocument();
	});

	it("highlights days with entries", () => {
		const datesWithEntries = ["2026-01-28", "2026-01-30"];
		render(
			<DatePicker
				selectedDate={today}
				onDateChange={vi.fn()}
				datesWithEntries={datesWithEntries}
			/>
		);

		// Open calendar
		const dateButton = screen.getByRole("button", { name: /January 30, 2026/ });
		fireEvent.click(dateButton);

		// Days with entries should have a marker
		const day28 = screen.getByText("28");
		const day30 = screen.getByText("30");

		expect(day28.closest("[data-has-entries]")).toHaveAttribute(
			"data-has-entries",
			"true"
		);
		expect(day30.closest("[data-has-entries]")).toHaveAttribute(
			"data-has-entries",
			"true"
		);
	});

	it("selects date from calendar", () => {
		const onDateChange = vi.fn();
		render(<DatePicker selectedDate={today} onDateChange={onDateChange} />);

		// Open calendar
		const dateButton = screen.getByRole("button", { name: /January 30, 2026/ });
		fireEvent.click(dateButton);

		// Click on day 25
		const day25 = screen.getByText("25");
		fireEvent.click(day25);

		expect(onDateChange).toHaveBeenCalledWith("2026-01-25");
	});

	it("navigates months in calendar", () => {
		render(<DatePicker selectedDate={today} onDateChange={vi.fn()} />);

		// Open calendar
		const dateButton = screen.getByRole("button", { name: /January 30, 2026/ });
		fireEvent.click(dateButton);

		// Click previous month
		const prevMonthButton = screen.getByLabelText("Previous month");
		fireEvent.click(prevMonthButton);

		expect(screen.getByText(/December 2025/)).toBeInTheDocument();
	});

	it("shows today button", () => {
		render(<DatePicker selectedDate={yesterday} onDateChange={vi.fn()} />);

		expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();
	});

	it("today button navigates to today", () => {
		const onDateChange = vi.fn();

		render(<DatePicker selectedDate={yesterday} onDateChange={onDateChange} />);

		const todayButton = screen.getByRole("button", { name: /today/i });
		fireEvent.click(todayButton);

		// Verify that onDateChange was called with a date string in correct format
		expect(onDateChange).toHaveBeenCalledWith(
			expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
		);
	});
});

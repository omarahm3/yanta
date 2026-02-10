import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { cn } from "../lib/utils";

export interface DatePickerProps {
	selectedDate: string;
	onDateChange: (date: string) => void;
	datesWithEntries?: string[];
	className?: string;
}

/**
 * Date picker with calendar for Journal navigation
 * Based on PRD Section 7.10 - Journal View
 */
export const DatePicker: React.FC<DatePickerProps> = ({
	selectedDate,
	onDateChange,
	datesWithEntries = [],
	className,
}) => {
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);
	const [viewDate, setViewDate] = useState(() => new Date(selectedDate));

	const selectedDateObj = useMemo(() => new Date(selectedDate), [selectedDate]);

	const formattedDate = useMemo(() => {
		return selectedDateObj.toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}, [selectedDateObj]);

	const handlePrevDay = () => {
		const prev = new Date(selectedDateObj);
		prev.setDate(prev.getDate() - 1);
		onDateChange(formatDateString(prev));
	};

	const handleNextDay = () => {
		const next = new Date(selectedDateObj);
		next.setDate(next.getDate() + 1);
		onDateChange(formatDateString(next));
	};

	const handleToday = () => {
		onDateChange(formatDateString(new Date()));
	};

	const handleDateClick = () => {
		setViewDate(selectedDateObj);
		setIsCalendarOpen(!isCalendarOpen);
	};

	const handleCalendarSelect = (date: Date) => {
		onDateChange(formatDateString(date));
		setIsCalendarOpen(false);
	};

	const handlePrevMonth = () => {
		const prev = new Date(viewDate);
		prev.setMonth(prev.getMonth() - 1);
		setViewDate(prev);
	};

	const handleNextMonth = () => {
		const next = new Date(viewDate);
		next.setMonth(next.getMonth() + 1);
		setViewDate(next);
	};

	const isToday = formatDateString(selectedDateObj) === formatDateString(new Date());

	return (
		<div className={cn("relative", className)}>
			<div className="flex items-center gap-2">
				{/* Previous day button */}
				<button
					type="button"
					onClick={handlePrevDay}
					aria-label="Previous day"
					className="p-2 text-text-secondary hover:text-accent transition-colors"
				>
					<ChevronLeft size={16} />
				</button>

				{/* Date button */}
				<button
					type="button"
					onClick={handleDateClick}
					className="px-4 py-2 text-sm font-medium text-text-primary hover:text-accent transition-colors"
				>
					{formattedDate}
				</button>

				{/* Next day button */}
				<button
					type="button"
					onClick={handleNextDay}
					aria-label="Next day"
					className="p-2 text-text-secondary hover:text-accent transition-colors"
				>
					<ChevronRight size={16} />
				</button>

				{/* Today button */}
				{!isToday && (
					<button
						type="button"
						onClick={handleToday}
						className="ml-2 px-3 py-1 text-xs bg-glass-bg/20 backdrop-blur-sm border border-glass-border rounded hover:border-accent transition-colors"
					>
						Today
					</button>
				)}
			</div>

			{/* Calendar dropdown */}
			{isCalendarOpen && (
				<div className="absolute top-full left-0 mt-2 p-3 bg-glass-bg/90 backdrop-blur-xl border border-glass-border rounded-lg shadow-lg z-50">
					<Calendar
						viewDate={viewDate}
						selectedDate={selectedDateObj}
						datesWithEntries={datesWithEntries}
						onSelect={handleCalendarSelect}
						onPrevMonth={handlePrevMonth}
						onNextMonth={handleNextMonth}
					/>
				</div>
			)}
		</div>
	);
};

interface CalendarDayButtonProps {
	day: number;
	year: number;
	month: number;
	selectedDate: Date;
	datesWithEntriesSet: Set<string>;
	onSelect: (date: Date) => void;
}

const CalendarDayButton: React.FC<CalendarDayButtonProps> = React.memo(
	({ day, year, month, selectedDate, datesWithEntriesSet, onSelect }) => {
		const date = useMemo(() => new Date(year, month, day), [year, month, day]);
		const dateString = formatDateString(date);
		const isSelected = formatDateString(selectedDate) === dateString;
		const hasEntries = datesWithEntriesSet.has(dateString);
		const handleClick = useCallback(() => onSelect(date), [date, onSelect]);
		return (
			<button
				type="button"
				onClick={handleClick}
				data-has-entries={hasEntries}
				className={cn(
					"w-8 h-8 flex items-center justify-center text-sm rounded relative transition-colors",
					isSelected ? "bg-accent text-white" : "hover:bg-glass-bg/20",
					hasEntries && !isSelected && "text-accent",
				)}
			>
				{day}
				{hasEntries && !isSelected && (
					<span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full" />
				)}
			</button>
		);
	},
);
CalendarDayButton.displayName = "CalendarDayButton";

interface CalendarProps {
	viewDate: Date;
	selectedDate: Date;
	datesWithEntries: string[];
	onSelect: (date: Date) => void;
	onPrevMonth: () => void;
	onNextMonth: () => void;
}

const Calendar: React.FC<CalendarProps> = ({
	viewDate,
	selectedDate,
	datesWithEntries,
	onSelect,
	onPrevMonth,
	onNextMonth,
}) => {
	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();

	const monthName = viewDate.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});

	// Get days in month
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const firstDayOfMonth = new Date(year, month, 1).getDay();

	// Create array of day numbers
	const days: (number | null)[] = [];

	// Add empty cells for days before the first day of the month
	for (let i = 0; i < firstDayOfMonth; i++) {
		days.push(null);
	}

	// Add days of the month
	for (let i = 1; i <= daysInMonth; i++) {
		days.push(i);
	}

	const datesWithEntriesSet = new Set(datesWithEntries);

	return (
		<div>
			{/* Month navigation */}
			<div className="flex items-center justify-between mb-3">
				<button
					type="button"
					onClick={onPrevMonth}
					aria-label="Previous month"
					className="p-1 text-text-secondary hover:text-accent"
				>
					<ChevronLeft size={16} />
				</button>
				<span className="text-sm font-medium">{monthName}</span>
				<button
					type="button"
					onClick={onNextMonth}
					aria-label="Next month"
					className="p-1 text-text-secondary hover:text-accent"
				>
					<ChevronRight size={16} />
				</button>
			</div>

			{/* Day headers */}
			<div className="grid grid-cols-7 gap-1 mb-1">
				{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
					<div
						key={day}
						className="w-8 h-8 flex items-center justify-center text-xs text-text-secondary"
					>
						{day}
					</div>
				))}
			</div>

			{/* Calendar grid */}
			<div data-testid="calendar-grid" className="grid grid-cols-7 gap-1">
				{days.map((day, index) => {
					if (day === null) {
						// biome-ignore lint/suspicious/noArrayIndexKey: empty calendar cells are stable placeholders
						return <div key={`empty-${index}`} className="w-8 h-8" />;
					}
					return (
						<CalendarDayButton
							key={day}
							day={day}
							year={year}
							month={month}
							selectedDate={selectedDate}
							datesWithEntriesSet={datesWithEntriesSet}
							onSelect={onSelect}
						/>
					);
				})}
			</div>
		</div>
	);
};

/**
 * Format date to YYYY-MM-DD string
 */
function formatDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

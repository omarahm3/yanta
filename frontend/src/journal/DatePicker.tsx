import * as Popover from "@radix-ui/react-popover";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../shared/utils/cn";
import { formatLocalDateString, parseLocalDate, todayLocalString } from "../shared/utils/date";

export interface DatePickerProps {
	selectedDate: string;
	onDateChange: (date: string) => void;
	datesWithEntries?: string[];
	className?: string;
}

/**
 * Date picker with calendar for Journal navigation
 * MRG-340: Rebuilt with proper a11y using Radix Popover
 */
export const DatePicker: React.FC<DatePickerProps> = ({
	selectedDate,
	onDateChange,
	datesWithEntries = [],
	className,
}) => {
	const [viewDate, setViewDate] = useState(() => parseLocalDate(selectedDate));
	const triggerRef = useRef<HTMLButtonElement>(null);

	const selectedDateObj = useMemo(() => parseLocalDate(selectedDate), [selectedDate]);

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
		onDateChange(formatLocalDateString(prev));
	};

	const handleNextDay = () => {
		const next = new Date(selectedDateObj);
		next.setDate(next.getDate() + 1);
		onDateChange(formatLocalDateString(next));
	};

	const handleToday = () => {
		onDateChange(todayLocalString());
	};

	const handleCalendarSelect = (date: Date) => {
		onDateChange(formatLocalDateString(date));
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

	const isToday = formatLocalDateString(selectedDateObj) === todayLocalString();

	return (
		<div className={cn("relative", className)}>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={handlePrevDay}
					aria-label="Previous day"
					className="p-2 text-text-secondary hover:text-accent transition-colors"
				>
					<ChevronLeft size={16} />
				</button>

				<Popover.Root>
					<Popover.Trigger asChild>
						<button
							ref={triggerRef}
							type="button"
							aria-haspopup="dialog"
							aria-expanded={undefined}
							className="px-4 py-2 text-sm font-medium text-text-primary hover:text-accent transition-colors"
						>
							{formattedDate}
						</button>
					</Popover.Trigger>
					<Popover.Portal>
						<Popover.Content
							sideOffset={8}
							align="start"
							className="p-3 bg-glass-bg/95 backdrop-blur-xl border border-glass-border rounded-lg shadow-lg z-50"
							onOpenAutoFocus={(e) => {
								e.preventDefault();
							}}
						>
							<Calendar
								viewDate={viewDate}
								selectedDate={selectedDateObj}
								datesWithEntries={datesWithEntries}
								onSelect={handleCalendarSelect}
								onPrevMonth={handlePrevMonth}
								onNextMonth={handleNextMonth}
								triggerRef={triggerRef}
							/>
							<Popover.Arrow className="fill-glass-bg/95" />
						</Popover.Content>
					</Popover.Portal>
				</Popover.Root>

				<button
					type="button"
					onClick={handleNextDay}
					aria-label="Next day"
					className="p-2 text-text-secondary hover:text-accent transition-colors"
				>
					<ChevronRight size={16} />
				</button>

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
		</div>
	);
};

interface CalendarProps {
	viewDate: Date;
	selectedDate: Date;
	datesWithEntries: string[];
	onSelect: (date: Date) => void;
	onPrevMonth: () => void;
	onNextMonth: () => void;
	triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const Calendar: React.FC<CalendarProps> = ({
	viewDate,
	selectedDate,
	datesWithEntries,
	onSelect,
	onPrevMonth,
	onNextMonth,
	triggerRef,
}) => {
	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();

	const monthName = viewDate.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});

	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const firstDayOfMonth = new Date(year, month, 1).getDay();

	const days: (number | null)[] = [];
	for (let i = 0; i < firstDayOfMonth; i++) {
		days.push(null);
	}
	for (let i = 1; i <= daysInMonth; i++) {
		days.push(i);
	}

	const datesWithEntriesSet = new Set(datesWithEntries);

	const [focusedDay, setFocusedDay] = useState<number | null>(() => {
		const selectedDay = selectedDate.getDate();
		const selectedMonth = selectedDate.getMonth();
		const selectedYear = selectedDate.getFullYear();
		if (selectedYear === year && selectedMonth === month) {
			return selectedDay;
		}
		return 1;
	});

	const gridRef = useRef<HTMLDivElement>(null);
	const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

	const setButtonRef = useCallback((day: number, el: HTMLButtonElement | null) => {
		if (el) {
			buttonRefs.current.set(String(day), el);
		} else {
			buttonRefs.current.delete(String(day));
		}
	}, []);

	useEffect(() => {
		if (focusedDay !== null) {
			const button = buttonRefs.current.get(String(focusedDay));
			button?.focus();
		}
	}, [focusedDay]);

	const handleGridKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (focusedDay === null) return;

			let newDay = focusedDay;
			let handled = false;

			switch (e.key) {
				case "ArrowLeft":
					newDay = Math.max(1, focusedDay - 1);
					handled = true;
					break;
				case "ArrowRight":
					newDay = Math.min(daysInMonth, focusedDay + 1);
					handled = true;
					break;
				case "ArrowUp":
					newDay = Math.max(1, focusedDay - 7);
					handled = true;
					break;
				case "ArrowDown":
					newDay = Math.min(daysInMonth, focusedDay + 7);
					handled = true;
					break;
				case "Home":
					newDay = 1;
					handled = true;
					break;
				case "End":
					newDay = daysInMonth;
					handled = true;
					break;
				case "Enter":
				case " ": {
					e.preventDefault();
					const date = new Date(year, month, focusedDay);
					onSelect(date);
					triggerRef.current?.focus();
					handled = true;
					break;
				}
				case "Escape":
					triggerRef.current?.focus();
					handled = true;
					break;
			}

			if (handled) {
				e.preventDefault();
				if (newDay !== focusedDay) {
					setFocusedDay(newDay);
				}
			}
		},
		[focusedDay, daysInMonth, year, month, onSelect, triggerRef],
	);

	return (
		<div>
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

			<div className="grid grid-cols-7 gap-1 mb-1">
				{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
					<div
						key={day}
						className="w-8 h-8 flex items-center justify-center text-xs text-text-secondary"
						aria-label={day}
					>
						{day}
					</div>
				))}
			</div>

			<div
				ref={gridRef}
				role="grid"
				aria-label={monthName}
				className="grid grid-cols-7 gap-1"
				onKeyDown={handleGridKeyDown}
			>
				{days.map((day, index) => {
					if (day === null) {
						return (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: empty calendar cells are stable placeholders
								key={`empty-${index}`}
								role="gridcell"
								tabIndex={-1}
								aria-hidden="true"
								className="w-8 h-8"
							/>
						);
					}

					const date = new Date(year, month, day);
					const dateString = formatLocalDateString(date);
					const isSelected = formatLocalDateString(selectedDate) === dateString;
					const hasEntries = datesWithEntriesSet.has(dateString);
					const isFocused = focusedDay === day;

					const fullDateLabel = date.toLocaleDateString(undefined, {
						weekday: "long",
						year: "numeric",
						month: "long",
						day: "numeric",
					});

					return (
						<button
							key={day}
							ref={(el) => setButtonRef(day, el)}
							type="button"
							role="gridcell"
							tabIndex={isFocused ? 0 : -1}
							aria-selected={isSelected}
							aria-label={fullDateLabel}
							data-has-entries={hasEntries}
							onClick={() => {
								onSelect(date);
								triggerRef.current?.focus();
							}}
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
				})}
			</div>
		</div>
	);
};

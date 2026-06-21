import { X } from "lucide-react";
import React, { type RefObject, useCallback, useEffect, useRef } from "react";
import logoImage from "../../assets/images/logo-universal.png";
import { useDensity } from "../stores/density.store";
import { useSidebarStateStore } from "../stores/sidebarState.store";
import { cn } from "../utils/cn";
import { List, ListItem } from "./List";
import { Tooltip } from "./Tooltip";

export interface SidebarSection {
	id: string;
	title: string;
	items: SidebarItem[];
}

export interface SidebarItemTooltip {
	tooltipId: string;
	description: string;
	shortcut?: string;
}

export interface SidebarItem {
	id: string;
	label: string;
	count?: number;
	active?: boolean;
	onClick?: () => void;
	tooltip?: SidebarItemTooltip;
	action?: {
		label: string;
		icon: string;
		onClick: (e: React.MouseEvent) => void;
	};
}

export interface SidebarProps {
	sections: SidebarSection[];
	className?: string;
}

const ChevronIcon: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
	<svg
		aria-hidden="true"
		className={cn("w-3 h-3 transition-transform duration-200", collapsed ? "-rotate-90" : "rotate-0")}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth={2.5}
	>
		<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
	</svg>
);

export const Sidebar: React.FC<SidebarProps> = ({ sections, className }) => {
	const { collapsedSections, toggleSection, sidebarWidth, setSidebarWidth } = useSidebarStateStore();
	const density = useDensity();
	const isCompact = density === "compact";

	const asideRef = useRef<HTMLElement>(null);
	const isDragging = useRef(false);
	const startX = useRef(0);
	const startWidth = useRef(sidebarWidth);

	const onResizeStart = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			isDragging.current = true;
			startX.current = e.clientX;
			startWidth.current = sidebarWidth;
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
		},
		[sidebarWidth],
	);

	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			if (!isDragging.current) return;
			const delta = e.clientX - startX.current;
			setSidebarWidth(startWidth.current + delta);
		};
		const onMouseUp = () => {
			if (!isDragging.current) return;
			isDragging.current = false;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		return () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};
	}, [setSidebarWidth]);

	const sidebarPad = isCompact ? "p-2" : "p-4";

	return (
		<aside
			ref={asideRef as RefObject<HTMLElement>}
			role="navigation"
			aria-label="Main navigation"
			className={cn(
				"h-full flex flex-col relative overflow-y-auto transition-all duration-200",
				className,
			)}
			style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
		>
			<div className={cn("flex-1 overflow-y-auto", sidebarPad)}>
				<div className={cn("flex items-center px-2", isCompact ? "mb-4" : "mb-8")}>
					<img src={logoImage} alt="YANTA" className={cn("w-auto object-contain opacity-90", isCompact ? "h-8" : "h-10")} />
				</div>

				<div className="space-y-4">
					{sections.map((section) => {
						const isCollapsed = collapsedSections.includes(section.id);
						return (
							<div key={section.id}>
								<button
									type="button"
									className={cn(
										"w-full px-2 flex items-center justify-between gap-1 text-xs font-semibold uppercase tracking-wider text-text-dim mb-2 opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded",
										isCompact && "text-[10px]",
									)}
									onClick={() => toggleSection(section.id)}
									aria-expanded={!isCollapsed}
									aria-controls={`sidebar-section-${section.id}`}
								>
									<span>{section.title}</span>
									<ChevronIcon collapsed={isCollapsed} />
								</button>

								<div
									id={`sidebar-section-${section.id}`}
									className={cn(
										"overflow-hidden transition-all duration-200",
										isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100",
									)}
								>
									<List variant="sidebar" className="space-y-0.5">
										{section.items.map((item) => {
											const listItemContent = (
												<ListItem
													key={item.id}
													variant="sidebar"
													active={item.active}
													onClick={item.onClick}
													aria-current={item.active ? "page" : undefined}
													className={cn(
														"sidebar-item group relative",
														item.active && "active",
														isCompact && "!py-1 !text-xs",
													)}
												>
													<span className="font-medium flex-1 truncate">{item.label}</span>
													{item.count !== undefined && (
														<span className={cn(
															"text-xs bg-bg-dark/30 px-1.5 py-0.5 rounded text-text-dim flex-shrink-0",
															isCompact && "text-[10px]",
														)}>
															{item.count}
														</span>
													)}
													{item.action && (
														<button
															type="button"
															title={item.action.label}
															aria-label={item.action.label}
															className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 ml-1 text-text-dim hover:text-text-bright transition-opacity flex-shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
															onClick={item.action.onClick}
														>
															<X className="w-3 h-3" aria-hidden="true" />
														</button>
													)}
												</ListItem>
											);

											if (item.tooltip) {
												return (
													<Tooltip
														key={item.id}
														tooltipId={item.tooltip.tooltipId}
														content={item.tooltip.description}
														shortcut={item.tooltip.shortcut}
														placement="right"
													>
														{listItemContent}
													</Tooltip>
												);
											}

											return listItemContent;
										})}
									</List>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			<div
				role="slider"
				aria-label="Sidebar width"
				aria-orientation="vertical"
				aria-valuenow={sidebarWidth}
				aria-valuemin={160}
				aria-valuemax={360}
				className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 transition-colors focus-visible:outline-none focus-visible:bg-accent/60"
				onMouseDown={onResizeStart}
				onKeyDown={(e) => {
					if (e.key === "ArrowLeft") setSidebarWidth(sidebarWidth - 16);
					if (e.key === "ArrowRight") setSidebarWidth(sidebarWidth + 16);
				}}
				tabIndex={0}
			/>
		</aside>
	);
};

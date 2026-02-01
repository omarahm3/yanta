import type React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export interface ProjectOption {
	id: string;
	alias: string;
	name: string;
}

export interface ProjectPickerProps {
	projects: ProjectOption[];
	selectedAlias: string | null;
	onSelect: (alias: string) => void;
	className?: string;
}

/**
 * Project selector dropdown with fuzzy search
 * Based on PRD Section 3.6 - Project Selector
 */
export const ProjectPicker: React.FC<ProjectPickerProps> = ({
	projects,
	selectedAlias,
	onSelect,
	className,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Filter projects by search
	const filteredProjects = projects.filter(
		(p) =>
			p.alias.toLowerCase().includes(searchValue.toLowerCase()) ||
			p.name.toLowerCase().includes(searchValue.toLowerCase()),
	);

	// Reset highlighted index when filtered list changes
	useEffect(() => {
		setHighlightedIndex(0);
	}, [searchValue]);

	// Focus input when dropdown opens
	useEffect(() => {
		if (isOpen && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isOpen]);

	// Close on click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		switch (e.key) {
			case "ArrowDown":
			case "j":
				e.preventDefault();
				setHighlightedIndex((prev) => (prev < filteredProjects.length - 1 ? prev + 1 : prev));
				break;
			case "ArrowUp":
			case "k":
				e.preventDefault();
				setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
				break;
			case "Enter":
			case "Tab":
				e.preventDefault();
				if (filteredProjects[highlightedIndex]) {
					onSelect(filteredProjects[highlightedIndex].alias);
					setIsOpen(false);
					setSearchValue("");
				}
				break;
			case "Escape":
				e.preventDefault();
				setIsOpen(false);
				setSearchValue("");
				break;
		}
	};

	const handleSelect = (alias: string) => {
		onSelect(alias);
		setIsOpen(false);
		setSearchValue("");
	};

	const displayAlias = selectedAlias || "Select project";

	return (
		<div ref={containerRef} className={cn("relative", className)}>
			{/* Trigger button */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between px-3 py-2 bg-[#232F3E] border border-[#3D4F63] rounded-lg text-[#E8E8E8] text-sm hover:border-[#61AFEF] transition-colors"
			>
				<span className="text-[#61AFEF]">@{displayAlias}</span>
				<span className="text-[#5C6B7A]">▾</span>
			</button>

			{/* Dropdown */}
			{isOpen && (
				<div className="absolute top-full left-0 right-0 mt-1 bg-[#232F3E] border border-[#3D4F63] rounded-lg shadow-lg z-50 overflow-hidden">
					{/* Search input */}
					<div className="p-2 border-b border-[#3D4F63]">
						<input
							ref={inputRef}
							type="text"
							value={searchValue}
							onChange={(e) => setSearchValue(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Search projects..."
							className="w-full px-2 py-1 bg-[#1B2636] border border-[#3D4F63] rounded text-sm text-[#E8E8E8] placeholder:text-[#5C6B7A] focus:outline-none focus:border-[#61AFEF]"
						/>
					</div>

					{/* Project list */}
					<div className="max-h-48 overflow-y-auto">
						{filteredProjects.length === 0 ? (
							<div className="px-3 py-2 text-sm text-[#5C6B7A]">No projects found</div>
						) : (
							filteredProjects.map((project, index) => (
								<button
									key={project.id}
									type="button"
									role="option"
									data-highlighted={index === highlightedIndex}
									aria-selected={project.alias === selectedAlias}
									onClick={() => handleSelect(project.alias)}
									className={cn(
										"w-full px-3 py-2 text-left text-sm transition-colors",
										index === highlightedIndex
											? "bg-[#2D3F54] text-[#61AFEF]"
											: "text-[#E8E8E8] hover:bg-[#2D3F54]",
									)}
								>
									<span className="text-[#61AFEF]">@{project.alias}</span>
									{project.name !== project.alias && (
										<span className="ml-2 text-[#5C6B7A]">{project.name}</span>
									)}
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
};

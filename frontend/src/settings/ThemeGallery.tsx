import React from "react";
import type { ThemeMode } from "../shared/stores/theme.store";

const THEMES = [
	{ id: "dark" as const, label: "Dark", description: "Easy on the eyes in low-light environments" },
	{ id: "light" as const, label: "Light", description: "Clear and crisp for bright environments" },
	{ id: "system" as const, label: "System", description: "Follow your operating system preference" },
];

interface ThemeGalleryProps {
	value: ThemeMode;
	onChange: (theme: ThemeMode) => void;
}

function renderPreview(themeId: ThemeMode) {
	switch (themeId) {
		case "dark": return { bg: "#0d1117", dot: "#58a6ff", bar1: "#c9d1d9", bar2: "#8b949e" };
		case "light": return { bg: "#ffffff", dot: "#0969da", bar1: "#1f2328", bar2: "#656d76" };
		case "system": return { bg: "#0d1117", dot: "#58a6ff", bar1: "#c9d1d9", bar2: "#8b949e" };
	}
}

export const ThemeGallery: React.FC<ThemeGalleryProps> = ({ value, onChange }) => {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
			{THEMES.map((theme) => {
				const isSelected = value === theme.id;
				const p = renderPreview(theme.id);
				return (
					<button
						type="button"
						key={theme.id}
						onClick={() => onChange(theme.id)}
						className={
							"relative flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-all cursor-pointer" +
							(isSelected
								? " border-accent ring-1 ring-accent bg-accent/10"
								: " border-border hover:border-text-dim hover:bg-surface")
						}
					>
						<div className="flex h-16 w-full items-center justify-center rounded-md border border-border">
							<div className="flex w-full h-full items-center justify-center gap-1.5 px-3 rounded-[4px]" style={{ background: p.bg }}>
								<div className="h-3 w-3 rounded-full" style={{ background: p.dot }} />
								<div className="h-2 w-12 rounded-sm" style={{ background: p.bar1 }} />
								<div className="h-2 w-8 rounded-sm" style={{ background: p.bar2 }} />
							</div>
						</div>
						<div>
							<div className="text-sm font-medium text-text">{theme.label}</div>
							<div className="text-xs text-text-dim">{theme.description}</div>
						</div>
					</button>
				);
			})}
		</div>
	);
};

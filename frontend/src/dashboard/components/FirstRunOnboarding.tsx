import React from "react";
import { Button, Heading, KeyDisplay, Text } from "../../shared/ui";

interface FirstRunOnboardingProps {
	/** Create the user's first note (creating a default project first if needed). */
	onCreateNote: () => void;
	/** Open the new-project flow so the user can set up their first project. */
	onCreateProject: () => void;
	/** True while the first note/project is being created. */
	isCreating?: boolean;
}

const TIPS: { label: string; keys: string[] }[] = [
	{ label: "Open the command palette to jump anywhere", keys: ["Ctrl / ⌘", "K"] },
	{ label: "Create a new note from any screen", keys: ["Ctrl / ⌘", "N"] },
	{ label: "Toggle keyboard help", keys: ["?"] },
];

/**
 * First-run / empty-vault onboarding (YANA-5, goal G2).
 *
 * Shown on the dashboard when the vault has no projects yet, turning a blank
 * screen into a welcoming guided state. The primary action creates the user's
 * first note in one click; the secondary action sets up a project.
 *
 * Purely presentational — all side effects are passed in as callbacks so this
 * stays trivial to test in isolation.
 */
export const FirstRunOnboarding: React.FC<FirstRunOnboardingProps> = ({
	onCreateNote,
	onCreateProject,
	isCreating = false,
}) => {
	return (
		<div
			className="flex h-full flex-col items-center justify-center p-8"
			role="region"
			aria-label="Welcome to YANTA"
		>
			<div className="w-full max-w-md space-y-8 text-center">
				<div className="space-y-3">
					<Heading as="h1" size="2xl">
						Welcome to YANTA
					</Heading>
					<Text variant="dim" size="base">
						Your vault is empty and entirely yours. Create your first note to get
						started — everything is plain JSON you fully own.
					</Text>
				</div>

				<div className="flex flex-col items-center gap-3">
					<Button
						variant="primary"
						size="lg"
						className="w-full"
						onClick={onCreateNote}
						disabled={isCreating}
						// biome-ignore lint/a11y/noAutofocus: first-run focus lands on the primary action for keyboard users
						autoFocus
					>
						{isCreating ? "Creating…" : "Create your first note"}
					</Button>
					<Button
						variant="secondary"
						size="md"
						className="w-full"
						onClick={onCreateProject}
						disabled={isCreating}
					>
						Set up a project
					</Button>
				</div>

				<div className="space-y-2 pt-2 text-left">
					<Text variant="dim" size="xs" weight="semibold" className="uppercase tracking-wider">
						Keyboard tips
					</Text>
					<ul className="space-y-2">
						{TIPS.map((tip) => (
							<li key={tip.label} className="flex items-center justify-between gap-3">
								<Text as="span" variant="dim" size="sm">
									{tip.label}
								</Text>
								<KeyDisplay keys={tip.keys} />
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
};

export interface ParsedGitError {
	type: string;
	title: string;
	message: string;
	technicalDetails: string;
	suggestions: string[];
}

export function parseGitError(error: unknown): ParsedGitError {
	const errorStr = String(error);

	if (errorStr.includes("GIT_NOT_ENABLED")) {
		return {
			type: "CONFIG",
			title: "Git Sync Not Enabled",
			message: "Git sync is not configured for this project.",
			technicalDetails: errorStr,
			suggestions: ["Go to Settings → Git Sync", "Enable git sync", "Configure your repository path"],
		};
	}

	if (errorStr.includes("NOT_A_REPO")) {
		return {
			type: "CONFIG",
			title: "Not a Git Repository",
			message: "The data directory is not initialized as a git repository.",
			technicalDetails: errorStr,
			suggestions: [
				"Go to Settings → Git Sync",
				"Click 'Migrate to Git Directory'",
				"Select a git repository folder",
			],
		};
	}

	if (errorStr.includes("REBASE_CONFLICT")) {
		return {
			type: "CONFLICT",
			title: "Sync paused — conflicting edits",
			message:
				"The same notes were changed on another device. Your local notes are safe and were left untouched — the sync was rolled back automatically.",
			technicalDetails: errorStr,
			suggestions: [
				"Try 'Sync Now' again — transient conflicts often clear on the next sync",
				"If it keeps happening, the same note was edited on two devices and needs a manual merge",
				"Open the data directory and run 'git pull --rebase', resolve the marked files, then 'git rebase --continue'",
			],
		};
	}

	if (errorStr.includes("MERGE_CONFLICT")) {
		return {
			type: "CONFLICT",
			title: "⚠️ Merge Conflicts Detected",
			message: "Local and remote changes conflict. You need to resolve them manually.",
			technicalDetails: errorStr,
			suggestions: [
				"Open your data directory in a terminal or git client",
				"Run 'git status' to see conflicted files",
				"Edit files to resolve conflicts (look for <<<<<<<, =======, >>>>>>>)",
				"Stage resolved files: git add <file>",
				"Complete the merge: git commit",
			],
		};
	}

	if (errorStr.includes("DIVERGED_BRANCHES")) {
		return {
			type: "CONFLICT",
			title: "⚠️ Branches Have Diverged",
			message:
				"Your local branch and remote branch have different commits. You need to reconcile them.",
			technicalDetails: errorStr,
			suggestions: [
				"Run 'Git Pull' to fetch and merge remote changes",
				"Or manually merge/rebase in your git client",
				"Then push your changes",
			],
		};
	}

	if (errorStr.includes("PUSH_REJECTED") || errorStr.includes("non-fast-forward")) {
		return {
			type: "SYNC",
			title: "🔄 Push Rejected - Pull Required",
			message: "Remote has changes you don't have locally. Pull first, then push.",
			technicalDetails: errorStr,
			suggestions: [
				"Run 'Git Pull' to fetch and merge remote changes",
				"Resolve any conflicts if they occur",
				"Then run 'Git Push' again",
			],
		};
	}

	if (
		errorStr.includes("UNRELATED_HISTORIES") ||
		errorStr.includes("refusing to merge unrelated histories")
	) {
		return {
			type: "CONFIG",
			title: "Unrelated Commit Histories",
			message: "Local and remote repositories have completely different histories.",
			technicalDetails: errorStr,
			suggestions: [
				"This usually happens when repositories were created separately",
				"You may need to use --allow-unrelated-histories",
				"Or start fresh by cloning the remote repository",
			],
		};
	}

	if (
		errorStr.includes("PUSH_FAILED") ||
		errorStr.includes("Connection") ||
		errorStr.includes("timed out")
	) {
		return {
			type: "NETWORK",
			title: "🌐 Connection Failed",
			message: "Cannot connect to remote repository.",
			technicalDetails: errorStr,
			suggestions: [
				"Check your internet connection",
				"Verify SSH keys or credentials are configured",
				"Check if remote repository URL is correct",
				"Try accessing the remote repository in a browser/terminal",
			],
		};
	}

	if (errorStr.includes("nothing to commit")) {
		return {
			type: "INFO",
			title: "✓ Already Up to Date",
			message: "No changes to sync.",
			technicalDetails: errorStr,
			suggestions: [],
		};
	}

	if (errorStr.includes("Already up to date") || errorStr.includes("Already up-to-date")) {
		return {
			type: "INFO",
			title: "✓ Already Up to Date",
			message: "Your local repository is already synchronized with remote.",
			technicalDetails: errorStr,
			suggestions: [],
		};
	}

	return {
		type: "UNKNOWN",
		title: "Git Operation Failed",
		message: "An unexpected git error occurred.",
		technicalDetails: errorStr,
		suggestions: [
			"Check the technical details below",
			"Try running the operation again",
			"Check git configuration and repository status",
		],
	};
}

/**
 * Like {@link parseGitError}, but returns a neutral, non-git-flavored error for
 * anything that isn't a recognized git failure. Use this for the global error
 * dialog so generic app errors (save failed, config update failed, …) read
 * clearly instead of being mislabeled as a "Git Operation Failed".
 */
export function parseAppError(error: unknown): ParsedGitError {
	const parsed = parseGitError(error);
	if (parsed.type !== "UNKNOWN") {
		return parsed;
	}

	const raw = String(error).trim();
	const firstLine =
		raw
			.split("\n")
			.map((line) => line.trim())
			.find((line) => line.length > 0)
			?.replace(/^[A-Z_]+:\s*/, "") ?? "";

	return {
		type: "ERROR",
		title: "Something went wrong",
		message: firstLine.slice(0, 240) || "An unexpected error occurred.",
		technicalDetails: raw,
		suggestions: [],
	};
}

export function formatGitErrorMessage(parsed: ParsedGitError): string {
	let message = `${parsed.title}\n\n${parsed.message}`;

	if (parsed.suggestions.length > 0) {
		message += `\n\n📝 Suggestions:\n${parsed.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
	}

	message += `\n\n🔧 Technical Details:\n${parsed.technicalDetails}`;

	return message;
}

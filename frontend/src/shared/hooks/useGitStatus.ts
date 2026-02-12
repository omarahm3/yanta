import { useCallback, useEffect, useState } from "react";
import { GetGitStatus } from "../../../bindings/yanta/internal/system/service";

export interface GitStatus {
	enabled: boolean;
	clean: boolean;
	modified: string[];
	untracked: string[];
	staged: string[];
	deleted: string[];
	renamed: string[];
	conflicted: string[];
	ahead: number;
	behind: number;
}

export interface UseGitStatusReturn {
	status: GitStatus | null;
	isLoading: boolean;
	error: string | null;
	refresh: () => Promise<void>;
}

const DEFAULT_STATUS: GitStatus = {
	enabled: false,
	clean: true,
	modified: [],
	untracked: [],
	staged: [],
	deleted: [],
	renamed: [],
	conflicted: [],
	ahead: 0,
	behind: 0,
};

function parseGitStatus(data: Record<string, unknown>): GitStatus {
	return {
		enabled: Boolean(data.enabled),
		clean: Boolean(data.clean),
		modified: Array.isArray(data.modified) ? data.modified : [],
		untracked: Array.isArray(data.untracked) ? data.untracked : [],
		staged: Array.isArray(data.staged) ? data.staged : [],
		deleted: Array.isArray(data.deleted) ? data.deleted : [],
		renamed: Array.isArray(data.renamed) ? data.renamed : [],
		conflicted: Array.isArray(data.conflicted) ? data.conflicted : [],
		ahead: typeof data.ahead === "number" ? data.ahead : 0,
		behind: typeof data.behind === "number" ? data.behind : 0,
	};
}

export function useGitStatus(pollInterval: number = 0): UseGitStatusReturn {
	const [status, setStatus] = useState<GitStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);
			const data = await GetGitStatus();
			if (data) {
				setStatus(parseGitStatus(data));
			} else {
				setStatus(DEFAULT_STATUS);
			}
		} catch (err) {
			setError(String(err));
			setStatus(null);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();

		if (pollInterval > 0) {
			const interval = setInterval(refresh, pollInterval);
			return () => clearInterval(interval);
		}
	}, [refresh, pollInterval]);

	return { status, isLoading, error, refresh };
}

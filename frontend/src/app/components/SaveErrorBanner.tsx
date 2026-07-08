import { AlertCircle, X } from "lucide-react";
import { useCallback } from "react";
import { useSaveErrorStore } from "../../shared/stores/saveError.store";

export function SaveErrorBanner() {
	const error = useSaveErrorStore((s) => s.error);
	const retryFn = useSaveErrorStore((s) => s.retryFn);
	const clearError = useSaveErrorStore((s) => s.clearError);

	const handleRetry = useCallback(async () => {
		if (retryFn) {
			await retryFn();
		}
	}, [retryFn]);

	if (!error) {
		return null;
	}

	return (
		<div className="fixed bottom-4 right-4 z-50 flex max-w-md items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 shadow-lg backdrop-blur-sm">
			<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
			<div className="flex-1">
				<p className="text-sm font-medium text-destructive">Save failed</p>
				<p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
				<div className="mt-3 flex gap-2">
					<button
						type="button"
						onClick={handleRetry}
						className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
					>
						Retry
					</button>
					<button
						type="button"
						onClick={clearError}
						className="rounded-md border border-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
					>
						Dismiss
					</button>
				</div>
			</div>
			<button
				type="button"
				onClick={clearError}
				className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
				aria-label="Close"
			>
				<X className="h-4 w-4" />
			</button>
		</div>
	);
}

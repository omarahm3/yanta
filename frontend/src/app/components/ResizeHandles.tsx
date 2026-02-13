import { System, Window } from "@wailsio/runtime";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IsFrameless } from "../../../bindings/yanta/internal/window/service";

/**
 * ResizeHandles Component
 *
 * Provides invisible resize handles around window edges for frameless windows on Linux.
 * Works seamlessly with Hyprland, i3wm, and GNOME window managers.
 *
 * Implements custom resize handling that:
 * - Triggers native window manager resize operations via mouse events
 * - Prevents window jumping by using platform-native protocols
 * - Works on both Wayland (Hyprland) and X11 (i3wm, GNOME)
 * - Respects min/max size constraints (enforced by WM)
 */
export const ResizeHandles: React.FC = () => {
	const [isLinux, setIsLinux] = useState(false);
	const [isFrameless, setIsFrameless] = useState(false);
	type Edge = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
	const resizeStateRef = useRef<{
		isResizing: boolean;
		edge: Edge | null;
		startMouseX: number;
		startMouseY: number;
		startWindowX: number;
		startWindowY: number;
		startWidth: number;
		startHeight: number;
	}>({
		isResizing: false,
		edge: null,
		startMouseX: 0,
		startMouseY: 0,
		startWindowX: 0,
		startWindowY: 0,
		startWidth: 0,
		startHeight: 0,
	});

	useEffect(() => {
		const checkEnvironment = async () => {
			// Only add resize handles on Linux
			if (!System.IsLinux()) {
				setIsLinux(false);
				return;
			}

			setIsLinux(true);

			// Check if frameless mode is enabled
			try {
				const frameless = await IsFrameless();
				setIsFrameless(frameless);
			} catch (err: unknown) {
				console.error("[ResizeHandles] Failed to check frameless mode:", err);
				setIsFrameless(false);
			}
		};

		checkEnvironment();
	}, []);

	/**
	 * Handles mouse movement during resize.
	 * Tracks cursor position and updates window size accordingly.
	 */
	const handleMouseMove = useCallback(async (e: MouseEvent) => {
		const state = resizeStateRef.current;
		if (!state.isResizing || !state.edge) return;

		// Use screen coordinates to align with window position APIs
		const deltaX = e.screenX - state.startMouseX;
		const deltaY = e.screenY - state.startMouseY;

		try {
			const minWidth = 400;
			const minHeight = 300;

			let newWidth = state.startWidth;
			let newHeight = state.startHeight;
			let newX = state.startWindowX;
			let newY = state.startWindowY;

			// Calculate new dimensions based on which edge is being dragged
			const edge = state.edge;

			const wantsEast = edge.includes("e");
			const wantsWest = edge.includes("w");
			const wantsSouth = edge.includes("s");
			const wantsNorth = edge.includes("n");

			// East (right) edge
			if (wantsEast) {
				newWidth = Math.max(minWidth, state.startWidth + deltaX);
			}
			// West (left) edge - adjust width and position to keep right edge anchored
			if (wantsWest) {
				const proposedWidth = state.startWidth - deltaX;
				const clampedWidth = Math.max(minWidth, proposedWidth);
				const rightEdge = state.startWindowX + state.startWidth;
				newWidth = clampedWidth;
				newX = rightEdge - clampedWidth;
			}

			// South (bottom) edge
			if (wantsSouth) {
				newHeight = Math.max(minHeight, state.startHeight + deltaY);
			}
			// North (top) edge - adjust height and position to keep bottom edge anchored
			if (wantsNorth) {
				const proposedHeight = state.startHeight - deltaY;
				const clampedHeight = Math.max(minHeight, proposedHeight);
				const bottomEdge = state.startWindowY + state.startHeight;
				newHeight = clampedHeight;
				newY = bottomEdge - clampedHeight;
			}

			// Order matters for perceived anchor:
			// - For west/north edges, move first to keep the anchored edge visually stable.
			// - For east/south edges, size only is enough.
			if (wantsWest || wantsNorth) {
				await Window.SetPosition(newX, newY);
				await Window.SetSize(newWidth, newHeight);
			} else {
				await Window.SetSize(newWidth, newHeight);
			}
		} catch (err: unknown) {
			console.error("[ResizeHandles] Error during resize:", err);
		}
	}, []);

	/**
	 * Handles mouse up to end resize operation.
	 */
	const handleMouseUp = useCallback(() => {
		resizeStateRef.current.isResizing = false;
		resizeStateRef.current.edge = null;

		document.body.style.userSelect = "";
		document.removeEventListener("mousemove", handleMouseMove);
		document.removeEventListener("mouseup", handleMouseUp);
	}, [handleMouseMove]);

	/**
	 * Handles mouse down on a resize handle.
	 * Initiates resize tracking.
	 */
	const handleResizeStart = useCallback(
		async (edge: Edge, event: React.MouseEvent) => {
			if (resizeStateRef.current.isResizing) return;
			if (event.button !== 0) return; // only respond to primary button
			const mouseScreenX = event.screenX;
			const mouseScreenY = event.screenY;

			try {
				const pos = await Window.Position();
				const width = await Window.Width();
				const height = await Window.Height();

				resizeStateRef.current = {
					isResizing: true,
					edge,
					startMouseX: mouseScreenX,
					startMouseY: mouseScreenY,
					startWindowX: pos.x,
					startWindowY: pos.y,
					startWidth: width,
					startHeight: height,
				};

				// Prevent text selection during resize
				document.body.style.userSelect = "none";
				document.addEventListener("mousemove", handleMouseMove);
				document.addEventListener("mouseup", handleMouseUp);
			} catch (err: unknown) {
				console.error(`[ResizeHandles] Failed to start resize from ${edge}:`, err);
			}
		},
		[handleMouseMove, handleMouseUp],
	);

	// Pre-bound mouse down handlers per edge to avoid creating new lambdas in JSX
	const handleTopMouseDown = useCallback(
		(e: React.MouseEvent) => handleResizeStart("n", e),
		[handleResizeStart],
	);
	const handleRightMouseDown = useCallback(
		(e: React.MouseEvent) => handleResizeStart("e", e),
		[handleResizeStart],
	);
	const handleBottomMouseDown = useCallback(
		(e: React.MouseEvent) => handleResizeStart("s", e),
		[handleResizeStart],
	);
	const handleLeftMouseDown = useCallback(
		(e: React.MouseEvent) => handleResizeStart("w", e),
		[handleResizeStart],
	);
	const handleTopLeftMouseDown = useCallback(
		(e: React.MouseEvent) => handleResizeStart("nw", e),
		[handleResizeStart],
	);
	const handleTopRightMouseDown = useCallback(
		(e: React.MouseEvent) => handleResizeStart("ne", e),
		[handleResizeStart],
	);
	const handleBottomLeftMouseDown = useCallback(
		(e: React.MouseEvent) => handleResizeStart("sw", e),
		[handleResizeStart],
	);
	const handleBottomRightMouseDown = useCallback(
		(e: React.MouseEvent) => handleResizeStart("se", e),
		[handleResizeStart],
	);

	// Only render resize handles on Linux in frameless mode
	if (!isLinux || !isFrameless) {
		return null;
	}

	return (
		<>
			{/* Top edge resize handle */}
			<div
				className="resize-handle resize-handle-top"
				onMouseDown={handleTopMouseDown}
				title="Drag to resize window (top edge)"
				role="presentation"
				aria-hidden="true"
				tabIndex={-1}
			/>

			{/* Right edge resize handle */}
			<div
				className="resize-handle resize-handle-right"
				onMouseDown={handleRightMouseDown}
				title="Drag to resize window (right edge)"
				role="presentation"
				aria-hidden="true"
				tabIndex={-1}
			/>

			{/* Bottom edge resize handle */}
			<div
				className="resize-handle resize-handle-bottom"
				onMouseDown={handleBottomMouseDown}
				title="Drag to resize window (bottom edge)"
				role="presentation"
				aria-hidden="true"
				tabIndex={-1}
			/>

			{/* Left edge resize handle */}
			<div
				className="resize-handle resize-handle-left"
				onMouseDown={handleLeftMouseDown}
				title="Drag to resize window (left edge)"
				role="presentation"
				aria-hidden="true"
				tabIndex={-1}
			/>

			{/* Top-left corner resize handle */}
			<div
				className="resize-handle resize-handle-corner resize-handle-top-left"
				onMouseDown={handleTopLeftMouseDown}
				title="Drag to resize window (top-left corner)"
				role="presentation"
				aria-hidden="true"
				tabIndex={-1}
			/>

			{/* Top-right corner resize handle */}
			<div
				className="resize-handle resize-handle-corner resize-handle-top-right"
				onMouseDown={handleTopRightMouseDown}
				title="Drag to resize window (top-right corner)"
				role="presentation"
				aria-hidden="true"
				tabIndex={-1}
			/>

			{/* Bottom-left corner resize handle */}
			<div
				className="resize-handle resize-handle-corner resize-handle-bottom-left"
				onMouseDown={handleBottomLeftMouseDown}
				title="Drag to resize window (bottom-left corner)"
				role="presentation"
				aria-hidden="true"
				tabIndex={-1}
			/>

			{/* Bottom-right corner resize handle */}
			<div
				className="resize-handle resize-handle-corner resize-handle-bottom-right"
				onMouseDown={handleBottomRightMouseDown}
				title="Drag to resize window (bottom-right corner)"
				role="presentation"
				aria-hidden="true"
				tabIndex={-1}
			/>
		</>
	);
};

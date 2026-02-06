import type { MutableRefObject } from "react";
import { useRef } from "react";

/**
 * Returns a ref object that always holds the latest value.
 * Manual equivalent of React's useEffectEvent (stable callback refs) for React 18.
 * Use when you need a stable ref identity but want callbacks (e.g. in event listeners)
 * to read the current value without being in the dependency array.
 *
 * @example
 * const valueRef = useLatestRef(value);
 * useEffect(() => {
 *   const handler = () => console.log(valueRef.current);
 *   window.addEventListener("resize", handler);
 *   return () => window.removeEventListener("resize", handler);
 * }, []); // valueRef.current is always up to date
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
	const ref = useRef(value);
	ref.current = value;
	return ref;
}

/**
 * Scale state is now in shared/stores/scale.store (Zustand).
 * Re-export useScale so existing imports from contexts keep working.
 */
export { useScale } from "../shared/stores/scale.store";

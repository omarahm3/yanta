import { coreToolsPlugin } from "./builtins/coreToolsPlugin";
import { registerPlugin } from "./registry";

let initialized = false;

export function registerBuiltInPlugins(): void {
	if (initialized) return;
	registerPlugin(coreToolsPlugin);
	initialized = true;
}

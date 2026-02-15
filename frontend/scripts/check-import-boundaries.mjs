import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/shared");
const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);
const violations = [];

function walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(fullPath);
			continue;
		}
		if (!exts.has(path.extname(entry.name))) {
			continue;
		}
		const text = fs.readFileSync(fullPath, "utf8");
		const lines = text.split(/\r?\n/);
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i];
			if (
				line.includes('from "@/config"') ||
				line.includes('from "@/config/public"') ||
				line.includes("from '../config'") ||
				line.includes('from "../config"') ||
				line.includes("from '../../config'") ||
				line.includes('from "../../config"')
			) {
				violations.push(`${fullPath}:${i + 1}`);
			}
		}
	}
}

if (!fs.existsSync(root)) {
	console.error(`Missing directory: ${root}`);
	process.exit(1);
}

walk(root);

if (violations.length > 0) {
	console.error("Import boundary violations detected:");
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	process.exit(1);
}

console.log("Import boundary check passed.");

/**
 * Generated type stubs for Wails bindings - project/service
 */

import type { Project } from "./models";

export function ListActive(): Promise<(Project | null)[]> {
	throw new Error("Wails binding not available");
}

export function ListArchived(): Promise<(Project | null)[]> {
	throw new Error("Wails binding not available");
}

export function GetAllDocumentCounts(): Promise<Record<string, number>> {
	throw new Error("Wails binding not available");
}

export function GetAllLastDocumentDates(): Promise<Record<string, string>> {
	throw new Error("Wails binding not available");
}

export function Archive(_alias: string): Promise<void> {
	throw new Error("Wails binding not available");
}

export function Restore(_alias: string): Promise<void> {
	throw new Error("Wails binding not available");
}

export function Create(_name: string, _alias: string): Promise<Project | null> {
	throw new Error("Wails binding not available");
}

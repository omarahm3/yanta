/**
 * Generated type stubs for Wails bindings - system/service
 */

import type { SyncResult } from "../git/models";
import type { SystemInfo } from "./models";

export interface GitSyncConfig {
	Enabled: boolean;
	AutoCommit: boolean;
	AutoPush: boolean;
	CommitInterval: number;
}

export function BackgroundQuit(): Promise<void> {
	throw new Error("Wails binding not available");
}

export function ForceQuit(): Promise<void> {
	throw new Error("Wails binding not available");
}

export function GetAppScale(): Promise<number> {
	throw new Error("Wails binding not available");
}

export function SetAppScale(_scale: number): Promise<void> {
	throw new Error("Wails binding not available");
}

export function GetSystemInfo(): Promise<SystemInfo | null> {
	throw new Error("Wails binding not available");
}

export function SetLogLevel(_level: string): Promise<void> {
	throw new Error("Wails binding not available");
}

export function GetKeepInBackground(): Promise<boolean> {
	throw new Error("Wails binding not available");
}

export function SetKeepInBackground(_enabled: boolean): Promise<void> {
	throw new Error("Wails binding not available");
}

export function GetStartHidden(): Promise<boolean> {
	throw new Error("Wails binding not available");
}

export function SetStartHidden(_enabled: boolean): Promise<void> {
	throw new Error("Wails binding not available");
}

export function CheckGitInstalled(): Promise<boolean> {
	throw new Error("Wails binding not available");
}

export function GetCurrentDataDirectory(): Promise<string> {
	throw new Error("Wails binding not available");
}

export function GetGitSyncConfig(): Promise<GitSyncConfig> {
	throw new Error("Wails binding not available");
}

export function SetGitSyncConfig(_config: GitSyncConfig): Promise<void> {
	throw new Error("Wails binding not available");
}

export function OpenDirectoryDialog(): Promise<string | null> {
	throw new Error("Wails binding not available");
}

export function ValidateMigrationTarget(_target: string): Promise<void> {
	throw new Error("Wails binding not available");
}

export function MigrateToGitDirectory(_target: string): Promise<void> {
	throw new Error("Wails binding not available");
}

export function SyncNow(): Promise<SyncResult | null> {
	throw new Error("Wails binding not available");
}

export function GitPull(): Promise<SyncResult | null> {
	throw new Error("Wails binding not available");
}

export function GitPush(): Promise<SyncResult | null> {
	throw new Error("Wails binding not available");
}

export function ReindexDatabase(): Promise<void> {
	throw new Error("Wails binding not available");
}

export function LogFromFrontend(
	_level: string,
	_message: string,
	_data?: Record<string, unknown>,
): Promise<void> {
	throw new Error("Wails binding not available");
}

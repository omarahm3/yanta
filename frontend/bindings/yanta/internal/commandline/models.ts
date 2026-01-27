/**
 * Generated type stubs for Wails bindings - commandline/models
 */

import type { Project } from "../project/models";

export interface DocumentResultData {
	requiresConfirmation?: boolean;
	confirmationCommand?: string;
	title?: string;
	documentPath?: string;
	flags?: string[];
}

export interface ProjectResultData {
	name?: string;
	alias?: string;
	project?: Project;
	requiresConfirmation?: boolean;
	confirmationCommand?: string;
	flags?: string[];
}

export interface ProjectResult {
	command: string;
	success: boolean;
	message?: string;
	name?: string;
	alias?: string;
	data?: ProjectResultData;
}

export interface DocumentResult {
	command: string;
	success: boolean;
	message?: string;
	title?: string;
	path?: string;
	tag?: string;
	data?: DocumentResultData;
}

export interface GlobalResultData {
	project?: Project;
}

export interface GlobalResult {
	command: string;
	success: boolean;
	message?: string;
	args?: string[];
	data?: GlobalResultData;
}

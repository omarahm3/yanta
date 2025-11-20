import * as projectModels from "../../bindings/yanta/internal/project/models";

export interface Project {
	id: string;
	name: string;
	alias: string;
	startDate: string;
	endDate?: string;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string;
	documentCount?: number;
}

export interface ExtendedProject extends Project {
	entryCount: number;
	lastEntry: string;
	status: "current" | "active" | "archived";
	isArchived?: boolean;
}

export type ProjectType = "work" | "side" | "learn";

export function projectFromModel(model: projectModels.Project): Project {
	return {
		id: model.id,
		name: model.name,
		alias: model.alias,
		startDate: model.start_date,
		endDate: model.end_date,
		createdAt: model.created_at,
		updatedAt: model.updated_at,
		deletedAt: model.deleted_at || undefined,
	};
}

export function projectsFromModels(models: (projectModels.Project | null)[]): Project[] {
	return models.filter((m): m is projectModels.Project => m !== null).map(projectFromModel);
}

export function projectToModel(proj: Project): projectModels.Project {
	return new projectModels.Project({
		id: proj.id,
		name: proj.name,
		alias: proj.alias,
		start_date: proj.startDate,
		end_date: proj.endDate || "",
		created_at: proj.createdAt,
		updated_at: proj.updatedAt,
		deleted_at: proj.deletedAt || "",
	});
}

export function extendProject(project: Project, isArchived: boolean = false): ExtendedProject {
	return {
		...project,
		entryCount: 0,
		lastEntry: "Unknown",
		status: isArchived ? "archived" : "active",
		isArchived,
	};
}

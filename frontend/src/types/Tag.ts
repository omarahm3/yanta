import type { tag } from "../../wailsjs/go/models";

export interface Tag {
	name: string;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string;
}

export function tagFromModel(model: tag.Tag): Tag {
	return {
		name: model.name,
		createdAt: model.created_at,
		updatedAt: model.updated_at,
		deletedAt: model.deleted_at || undefined,
	};
}

export function tagsFromModels(models: tag.Tag[]): Tag[] {
	return models.map(tagFromModel);
}

export function tagToModel(t: Tag): tag.Tag {
	return {
		name: t.name,
		created_at: t.createdAt,
		updated_at: t.updatedAt,
		deleted_at: t.deletedAt || "",
	};
}

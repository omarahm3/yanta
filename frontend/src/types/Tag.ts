import * as tagModels from "../../bindings/yanta/internal/tag/models";

export interface Tag {
	name: string;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string;
}

export function tagFromModel(model: tagModels.Tag): Tag {
	return {
		name: model.name,
		createdAt: model.created_at,
		updatedAt: model.updated_at,
		deletedAt: model.deleted_at || undefined,
	};
}

export function tagsFromModels(models: (tagModels.Tag | null)[]): Tag[] {
	return models.filter((m): m is tagModels.Tag => m !== null).map(tagFromModel);
}

export function tagToModel(t: Tag): tagModels.Tag {
	return new tagModels.Tag({
		name: t.name,
		created_at: t.createdAt,
		updated_at: t.updatedAt,
		deleted_at: t.deletedAt || "",
	});
}

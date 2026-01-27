/**
 * Generated type stubs for Wails bindings - tag/models
 */

export class Tag {
	name: string = "";
	created_at: string = "";
	updated_at: string = "";
	deleted_at: string = "";

	constructor(data?: Partial<Tag>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

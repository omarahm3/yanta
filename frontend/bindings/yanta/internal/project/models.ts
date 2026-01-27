/**
 * Generated type stubs for Wails bindings - project/models
 */

export class Project {
	id: string = "";
	name: string = "";
	alias: string = "";
	start_date: string = "";
	end_date: string = "";
	created_at: string = "";
	updated_at: string = "";
	deleted_at: string = "";

	constructor(data?: Partial<Project>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

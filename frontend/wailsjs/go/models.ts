export namespace commandline {
	
	export enum DocumentCommand {
	    New = "new",
	    Doc = "doc",
	    Archive = "archive",
	    Unarchive = "unarchive",
	    Delete = "delete",
	    Tag = "tag",
	    Untag = "untag",
	    Tags = "tags",
	}
	export enum ProjectCommand {
	    New = "new",
	    Archive = "archive",
	    Unarchive = "unarchive",
	    Rename = "rename",
	    Delete = "delete",
	}
	export enum GlobalCommand {
	    Switch = "switch",
	}
	export class DocumentResultData {
	    documentPath?: string;
	    title?: string;
	
	    static createFrom(source: any = {}) {
	        return new DocumentResultData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.documentPath = source["documentPath"];
	        this.title = source["title"];
	    }
	}
	export class DocumentResult {
	    success: boolean;
	    message: string;
	    data?: DocumentResultData;
	    context: string;
	
	    static createFrom(source: any = {}) {
	        return new DocumentResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.data = this.convertValues(source["data"], DocumentResultData);
	        this.context = source["context"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class GlobalResultData {
	    project?: project.Project;
	
	    static createFrom(source: any = {}) {
	        return new GlobalResultData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project = this.convertValues(source["project"], project.Project);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GlobalResult {
	    success: boolean;
	    message: string;
	    data?: GlobalResultData;
	    context: string;
	
	    static createFrom(source: any = {}) {
	        return new GlobalResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.data = this.convertValues(source["data"], GlobalResultData);
	        this.context = source["context"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ProjectResultData {
	    project?: project.Project;
	
	    static createFrom(source: any = {}) {
	        return new ProjectResultData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project = this.convertValues(source["project"], project.Project);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProjectResult {
	    success: boolean;
	    message: string;
	    data?: ProjectResultData;
	    context: string;
	
	    static createFrom(source: any = {}) {
	        return new ProjectResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.data = this.convertValues(source["data"], ProjectResultData);
	        this.context = source["context"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace document {
	
	export class BlockNoteContent {
	    type: string;
	    text?: string;
	    styles?: Record<string, any>;
	    href?: string;
	    content?: string;
	
	    static createFrom(source: any = {}) {
	        return new BlockNoteContent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.text = source["text"];
	        this.styles = source["styles"];
	        this.href = source["href"];
	        this.content = source["content"];
	    }
	}
	export class BlockNoteBlock {
	    id: string;
	    type: string;
	    props?: Record<string, any>;
	    content?: BlockNoteContent[];
	    children?: BlockNoteBlock[];
	
	    static createFrom(source: any = {}) {
	        return new BlockNoteBlock(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.props = source["props"];
	        this.content = this.convertValues(source["content"], BlockNoteContent);
	        this.children = this.convertValues(source["children"], BlockNoteBlock);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Document {
	    path: string;
	    project_alias: string;
	    title: string;
	    mtime_ns: number;
	    size_bytes: number;
	    has_code: boolean;
	    has_images: boolean;
	    has_links: boolean;
	    created_at: string;
	    updated_at: string;
	    deleted_at: string;
	    tags: string[];
	
	    static createFrom(source: any = {}) {
	        return new Document(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.project_alias = source["project_alias"];
	        this.title = source["title"];
	        this.mtime_ns = source["mtime_ns"];
	        this.size_bytes = source["size_bytes"];
	        this.has_code = source["has_code"];
	        this.has_images = source["has_images"];
	        this.has_links = source["has_links"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	        this.deleted_at = source["deleted_at"];
	        this.tags = source["tags"];
	    }
	}
	export class DocumentMeta {
	    project: string;
	    title: string;
	    tags: string[];
	    aliases?: string[];
	    created: string;
	    updated: string;
	
	    static createFrom(source: any = {}) {
	        return new DocumentMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project = source["project"];
	        this.title = source["title"];
	        this.tags = source["tags"];
	        this.aliases = source["aliases"];
	        this.created = source["created"];
	        this.updated = source["updated"];
	    }
	}
	export class DocumentFile {
	    meta: DocumentMeta;
	    blocks: BlockNoteBlock[];
	
	    static createFrom(source: any = {}) {
	        return new DocumentFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.meta = this.convertValues(source["meta"], DocumentMeta);
	        this.blocks = this.convertValues(source["blocks"], BlockNoteBlock);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class DocumentWithTags {
	    path: string;
	    project_alias: string;
	    title: string;
	    mtime_ns: number;
	    size_bytes: number;
	    has_code: boolean;
	    has_images: boolean;
	    has_links: boolean;
	    created_at: string;
	    updated_at: string;
	    deleted_at: string;
	    tags: string[];
	    File?: DocumentFile;
	    Tags: string[];
	
	    static createFrom(source: any = {}) {
	        return new DocumentWithTags(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.project_alias = source["project_alias"];
	        this.title = source["title"];
	        this.mtime_ns = source["mtime_ns"];
	        this.size_bytes = source["size_bytes"];
	        this.has_code = source["has_code"];
	        this.has_images = source["has_images"];
	        this.has_links = source["has_links"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	        this.deleted_at = source["deleted_at"];
	        this.tags = source["tags"];
	        this.File = this.convertValues(source["File"], DocumentFile);
	        this.Tags = source["Tags"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SaveRequest {
	    Path: string;
	    ProjectAlias: string;
	    Title: string;
	    Blocks: BlockNoteBlock[];
	    Tags: string[];
	
	    static createFrom(source: any = {}) {
	        return new SaveRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Path = source["Path"];
	        this.ProjectAlias = source["ProjectAlias"];
	        this.Title = source["Title"];
	        this.Blocks = this.convertValues(source["Blocks"], BlockNoteBlock);
	        this.Tags = source["Tags"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace project {
	
	export class Cache {
	
	
	    static createFrom(source: any = {}) {
	        return new Cache(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}
	export class Project {
	    id: string;
	    name: string;
	    alias: string;
	    start_date: string;
	    end_date: string;
	    created_at: string;
	    updated_at: string;
	    deleted_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.alias = source["alias"];
	        this.start_date = source["start_date"];
	        this.end_date = source["end_date"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	        this.deleted_at = source["deleted_at"];
	    }
	}

}

export namespace search {
	
	export class Result {
	    id: string;
	    title: string;
	    snippet: string;
	    updated: string;
	
	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.snippet = source["snippet"];
	        this.updated = source["updated"];
	    }
	}

}

export namespace system {
	
	export class AppInfo {
	    version: string;
	    buildCommit: string;
	    buildDate: string;
	    platform: string;
	    goVersion: string;
	    databasePath: string;
	    logLevel: string;
	
	    static createFrom(source: any = {}) {
	        return new AppInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.buildCommit = source["buildCommit"];
	        this.buildDate = source["buildDate"];
	        this.platform = source["platform"];
	        this.goVersion = source["goVersion"];
	        this.databasePath = source["databasePath"];
	        this.logLevel = source["logLevel"];
	    }
	}
	export class DatabaseInfo {
	    entriesCount: number;
	    projectsCount: number;
	    tagsCount: number;
	    storageUsed: string;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entriesCount = source["entriesCount"];
	        this.projectsCount = source["projectsCount"];
	        this.tagsCount = source["tagsCount"];
	        this.storageUsed = source["storageUsed"];
	    }
	}
	export class SystemInfo {
	    app: AppInfo;
	    database: DatabaseInfo;
	
	    static createFrom(source: any = {}) {
	        return new SystemInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.app = this.convertValues(source["app"], AppInfo);
	        this.database = this.convertValues(source["database"], DatabaseInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace tag {
	
	export class Tag {
	    name: string;
	    created_at: string;
	    updated_at: string;
	    deleted_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Tag(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	        this.deleted_at = source["deleted_at"];
	    }
	}

}


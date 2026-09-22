export type RepositoryCommand =
	| { type: "rename-session"; url: string; alias: string }
	| { type: "delete-session"; slug: string; url: string }
	| { type: "delete-repository"; slug: string };

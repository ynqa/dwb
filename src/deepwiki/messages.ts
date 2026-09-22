import type { RepositoryCommand } from "@/deepwiki/repositoryCommand";

export type BookmarkCommand = RepositoryCommand | { type: "initialize" };

export function isCommand(value: unknown): value is BookmarkCommand {
	if (!value || typeof value !== "object") return false;
	const message = value as Record<string, unknown>;
	switch (message.type) {
		case "initialize":
			return true;
		case "rename-session":
			return (
				typeof message.url === "string" && typeof message.alias === "string"
			);
		case "delete-session":
			return (
				typeof message.slug === "string" && typeof message.url === "string"
			);
		case "delete-repository":
			return typeof message.slug === "string";
		default:
			return false;
	}
}

export type RepositoryCommand =
	| { type: "rename-session"; url: string; alias: string }
	| { type: "delete-session"; slug: string; url: string }
	| { type: "delete-repository"; slug: string };

export type ExtensionCommand = RepositoryCommand | { type: "initialize" };

export function isCommand(value: unknown): value is ExtensionCommand {
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

export async function sendCommand(command: ExtensionCommand): Promise<void> {
	const result = await chrome.runtime.sendMessage(command);
	if (!result?.ok)
		throw new Error(result?.error ?? "The extension did not respond.");
}

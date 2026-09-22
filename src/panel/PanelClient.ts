import type { RepositoryStore } from "@/deepwiki/repository";
import type { RepositoryCommand } from "@/deepwiki/repositoryCommand";

// Services required by the UI, independent of where the panel is displayed.
export interface PanelClient {
	bookmarks: {
		read(): Promise<RepositoryStore>;
		subscribe(listener: (store: RepositoryStore) => void): () => void;
		execute(command: RepositoryCommand): Promise<void>;
	};
	navigation: {
		readUrl(): Promise<string>;
		subscribe(listener: () => void): () => void;
		openUrl(url: string): Promise<void>;
	};
}

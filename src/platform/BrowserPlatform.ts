export type Unsubscribe = () => void;

export interface BrowserTab {
	id?: number;
	windowId: number;
	url?: string;
}

export interface StorageArea {
	get(key: string | null): Promise<Record<string, unknown>>;
	set(values: Record<string, unknown>): Promise<void>;
	remove(keys: string | string[]): Promise<void>;
	subscribe(key: string, listener: (value: unknown) => void): Unsubscribe;
}

// Browser capabilities only. No vendor types or application-specific rules.
export interface BrowserPlatform {
	storage: { local: StorageArea; session: StorageArea };
	tabs: {
		query(query: {
			active?: boolean;
			currentWindow?: boolean;
			url?: string;
		}): Promise<BrowserTab[]>;
		update(tabId: number, url: string): Promise<void>;
		create(url: string, windowId?: number): Promise<void>;
		onChanged(listener: () => void): Unsubscribe;
		onRemoved(listener: (tabId: number) => void): Unsubscribe;
	};
	navigation: {
		// Adapters deliver active, top-level navigations only.
		onNavigated(listener: (tabId: number, url: string) => void): Unsubscribe;
		onCreatedTarget(
			listener: (sourceTabId: number, tabId: number, url: string) => void,
		): Unsubscribe;
	};
	lifecycle: { onReady(listener: () => void): Unsubscribe };
	messages: {
		send(message: unknown): Promise<void>;
		// The adapter authenticates the sender before invoking application code.
		listen<T>(
			accepts: (message: unknown) => message is T,
			handler: (message: T) => Promise<void>,
		): Unsubscribe;
	};
}

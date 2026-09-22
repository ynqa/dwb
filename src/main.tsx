import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import React from "react";
import ReactDOM from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@/App.css";
import { Dashboard } from "@/Dashboard";
import type { PanelClient } from "@/panel/PanelClient";

export function mountPanel(client: PanelClient) {
	ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
		<React.StrictMode>
			<MantineProvider defaultColorScheme="dark">
				<Notifications
					position="bottom-left"
					containerWidth="calc(100% - 24px)"
					zIndex={10_000}
				/>
				<Dashboard client={client} />
			</MantineProvider>
		</React.StrictMode>,
	);
}

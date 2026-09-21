import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import React from "react";
import ReactDOM from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@/App.css";
import { Dashboard } from "@/Dashboard";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<MantineProvider defaultColorScheme="dark">
			<Notifications
				position="bottom-left"
				containerWidth="calc(100% - 24px)"
				zIndex={10_000}
			/>
			<Dashboard />
		</MantineProvider>
	</React.StrictMode>,
);

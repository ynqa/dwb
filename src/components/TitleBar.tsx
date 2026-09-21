import { Flex, Text } from "@mantine/core";
import styles from "@/components/TitleBar.module.css";

export function TitleBar() {
	return (
		<Flex className={styles.titleBar}>
			<img src="icons/48.png" width={36} height={36} alt="" />
			<Text className={styles.title}>DeepWiki Bookmarker</Text>
		</Flex>
	);
}

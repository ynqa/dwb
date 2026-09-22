import {
	Box,
	Collapse,
	Divider,
	Flex,
	NavLink,
	ScrollArea,
	Stack,
	Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronRight, FiHome } from "react-icons/fi";
import { SidebarContextMenu } from "@/components/SidebarContextMenu";
import { TitleBar } from "@/components/TitleBar";
import styles from "@/Dashboard.module.css";
import { useRepositories } from "@/hooks/useRepositories";
import { HOME_URL } from "@/deepwiki/constants";
import {
	formatSessionLabel,
	normalizeUrl,
	parseDeepWikiUrl,
} from "@/deepwiki/deepWikiUrl";
import { findSessionOwner } from "@/deepwiki/repository";
import { useActiveTab } from "@/hooks/useActiveTab";
import type { PanelClient } from "@/panel/PanelClient";
import {
	compareRepositorySlug,
	compareSessionCreatedAt,
} from "@/deepwiki/repositorySort";

export function Dashboard({ client }: { client: PanelClient }) {
	// Repository store (Map-based for faster in-memory operations)
	const { repositoryStore, mutate, loading, error } = useRepositories(client);
	const repositories = useMemo(
		() =>
			Array.from(repositoryStore.entries())
				.sort(([left], [right]) => compareRepositorySlug(left, right))
				.map(([slug, sessionsByUrl]) => ({
					slug,
					sessions: Array.from(sessionsByUrl.values()).sort(
						compareSessionCreatedAt,
					),
				})),
		[repositoryStore],
	);
	// Currently selected URL
	const [selectedUrl, setSelectedUrl] = useActiveTab(client);
	// Open state of repository groups in sidebar
	const [openedRepositories, setOpenedRepositories] = useState<Set<string>>(
		() => new Set(),
	);
	// Inline alias editing state for the selected session
	const [editingSessionUrl, setEditingSessionUrl] = useState<string | null>(
		null,
	);
	const [sessionAliasDraft, setSessionAliasDraft] = useState("");
	const sessionAliasInputRef = useRef<HTMLInputElement | null>(null);

	// Function to show error notifications
	const notifyError = useCallback((message: string) => {
		notifications.show({
			title: "Error",
			message,
			color: "red",
			withBorder: true,
		});
	}, []);

	// Parse the selected URL to determine its kind
	const selectedKind = useMemo(
		() => parseDeepWikiUrl(selectedUrl),
		[selectedUrl],
	);
	// Determine the owner repository of the selected session, if applicable
	const selectedSessionOwner = useMemo(() => {
		if (selectedKind.type !== "session") {
			return null;
		}

		return findSessionOwner(repositoryStore, selectedUrl);
	}, [repositoryStore, selectedKind, selectedUrl]);

	// Keep selected repository/session owner expanded in sidebar
	useEffect(() => {
		if (selectedKind.type === "repository") {
			setOpenedRepositories((prev) => {
				if (prev.has(selectedKind.slug)) {
					return prev;
				}
				const next = new Set(prev);
				next.add(selectedKind.slug);
				return next;
			});
			return;
		}

		if (selectedKind.type === "session" && selectedSessionOwner) {
			setOpenedRepositories((prev) => {
				if (prev.has(selectedSessionOwner)) {
					return prev;
				}
				const next = new Set(prev);
				next.add(selectedSessionOwner);
				return next;
			});
		}
	}, [selectedKind, selectedSessionOwner]);

	const navigate = useCallback(
		async (url: string) => {
			try {
				await client.navigation.openUrl(url);
				setSelectedUrl(normalizeUrl(url));
			} catch (error: unknown) {
				notifyError(String(error));
			}
		},
		[client, notifyError, setSelectedUrl],
	);

	// Handlers for starting, canceling, and committing session alias edits
	const startSessionAliasEdit = useCallback(
		(sessionUrl: string, currentAlias?: string) => {
			setEditingSessionUrl(sessionUrl);
			setSessionAliasDraft(currentAlias ?? "");
		},
		[],
	);

	// Reset session alias editing state
	const cancelSessionAliasEdit = useCallback(() => {
		setEditingSessionUrl(null);
		setSessionAliasDraft("");
	}, []);

	// Commit the edited alias to the repository store
	const commitSessionAliasEdit = useCallback(
		(sessionUrl: string, aliasDraft: string) => {
			mutate({ type: "rename-session", url: sessionUrl, alias: aliasDraft });
			setEditingSessionUrl(null);
			setSessionAliasDraft("");
		},
		[mutate],
	);

	// Handler to initiate alias editing from the context menu
	const handleStartSessionAliasEdit = useCallback(
		(slug: string, sessionUrl: string) => {
			const currentAlias = repositoryStore.get(slug)?.get(sessionUrl)?.alias;
			startSessionAliasEdit(sessionUrl, currentAlias);
		},
		[repositoryStore, startSessionAliasEdit],
	);

	// Effect to focus and select the input when starting to edit a session alias
	useEffect(() => {
		if (!editingSessionUrl) {
			return;
		}

		sessionAliasInputRef.current?.focus();
		sessionAliasInputRef.current?.select();
	}, [editingSessionUrl]);

	const handleDeleteRepository = (slug: string) => {
		mutate({ type: "delete-repository", slug });
		setOpenedRepositories((previous) => {
			const next = new Set(previous);
			next.delete(slug);
			return next;
		});
	};
	const handleDeleteSession = (slug: string, url: string) => {
		mutate({ type: "delete-session", slug, url });
	};

	// Toggle the fold state of a repository group in the sidebar
	const toggleRepositoryFold = useCallback((slug: string) => {
		setOpenedRepositories((prev) => {
			const next = new Set(prev);
			if (next.has(slug)) {
				next.delete(slug);
			} else {
				next.add(slug);
			}
			return next;
		});
	}, []);

	return (
		<Flex className={styles.dashboardRoot}>
			<TitleBar />

			<Flex className={styles.dashboardBody}>
				<SidebarContextMenu
					onDeleteRepository={handleDeleteRepository}
					onStartSessionAliasEdit={handleStartSessionAliasEdit}
					onDeleteSession={handleDeleteSession}
				>
					{({ openContextMenu, sidebarRef }) => (
						<Box ref={sidebarRef} className={styles.sidebar}>
							<Stack className={styles.sidebarStack}>
								<NavLink
									active={selectedKind.type === "home"}
									className={styles.navLinkRoot}
									label="Home"
									leftSection={<FiHome size={16} />}
									onClick={() => void navigate(HOME_URL)}
									variant={selectedKind.type === "home" ? "filled" : "subtle"}
								/>

								<Divider
									color="#2c2c2c"
									label={
										<Text className={styles.repositoriesHeading}>
											Repositories
										</Text>
									}
									labelPosition="center"
								/>

								<ScrollArea
									className={styles.repositoriesScroll}
									offsetScrollbars
								>
									<Stack className={styles.repositoryList}>
										{loading ? (
											<Text size="sm" c="dimmed">
												Loading bookmarks…
											</Text>
										) : null}
										{error ? (
											<Text size="sm" c="red">
												{error}
											</Text>
										) : null}
										{!loading && !error && repositories.length === 0 ? (
											<Text size="sm" c="dimmed">
												Open DeepWiki and visit a repository to start. Your
												repositories and search sessions will appear here
												automatically.
											</Text>
										) : null}

										{repositories.map((repo) => {
											const isRepoSelected =
												selectedKind.type === "repository" &&
												selectedKind.slug === repo.slug;
											const isRepoOpened = openedRepositories.has(repo.slug);
											const hasSessions = repo.sessions.length > 0;
											return (
												<Stack
													key={repo.slug}
													className={styles.repositoryGroup}
												>
													<NavLink
														active={isRepoSelected}
														className={
															hasSessions
																? `${styles.navLinkRoot} ${styles.navLinkRootWithFold}`
																: styles.navLinkRoot
														}
														label={
															<Text className={styles.repositoryLabel}>
																{repo.slug}
															</Text>
														}
														onClick={() =>
															void navigate(`https://deepwiki.com/${repo.slug}`)
														}
														onContextMenu={(event) =>
															openContextMenu(event, {
																type: "repository",
																slug: repo.slug,
															})
														}
														rightSection={
															hasSessions ? (
																<Box
																	aria-label={
																		isRepoOpened
																			? "Collapse repository sessions"
																			: "Expand repository sessions"
																	}
																	className={styles.repoFoldToggle}
																	component="span"
																	data-opened={isRepoOpened || undefined}
																	onClick={(event) => {
																		event.preventDefault();
																		event.stopPropagation();
																		toggleRepositoryFold(repo.slug);
																	}}
																	onKeyDown={(event) => {
																		if (
																			event.key === " " ||
																			event.key === "Enter"
																		) {
																			event.preventDefault();
																			event.stopPropagation();
																			toggleRepositoryFold(repo.slug);
																		}
																	}}
																	role="button"
																	tabIndex={0}
																>
																	<FiChevronRight size={14} />
																</Box>
															) : null
														}
														variant={isRepoSelected ? "filled" : "subtle"}
													/>
													{hasSessions ? (
														<Collapse in={isRepoOpened}>
															<Box className={styles.sessionListContainer}>
																<Stack className={styles.sessionList}>
																	{repo.sessions.map((session) => {
																		const isSessionSelected =
																			selectedUrl === session.url;
																		const isSessionEditing =
																			editingSessionUrl === session.url;
																		const displayLabel =
																			session.alias?.trim() ||
																			formatSessionLabel(session.url);
																		return (
																			<NavLink
																				key={session.url}
																				active={isSessionSelected}
																				className={styles.navLinkRoot}
																				label={
																					isSessionEditing ? (
																						<input
																							ref={sessionAliasInputRef}
																							aria-label="Session alias"
																							className={
																								styles.sessionAliasInput
																							}
																							onBlur={() =>
																								commitSessionAliasEdit(
																									session.url,
																									sessionAliasDraft,
																								)
																							}
																							onChange={(event) =>
																								setSessionAliasDraft(
																									event.currentTarget.value,
																								)
																							}
																							onClick={(event) =>
																								event.stopPropagation()
																							}
																							onKeyDown={(event) => {
																								if (event.key === "Escape") {
																									event.preventDefault();
																									event.stopPropagation();
																									cancelSessionAliasEdit();
																								} else if (
																									event.key === "Enter"
																								) {
																									event.preventDefault();
																									event.stopPropagation();
																									commitSessionAliasEdit(
																										session.url,
																										sessionAliasDraft,
																									);
																								}
																							}}
																							onMouseDown={(event) =>
																								event.stopPropagation()
																							}
																							placeholder={formatSessionLabel(
																								session.url,
																							)}
																							type="text"
																							value={sessionAliasDraft}
																						/>
																					) : (
																						<Text
																							className={styles.sessionLabel}
																						>
																							{displayLabel}
																						</Text>
																					)
																				}
																				onClick={() => {
																					if (isSessionEditing) {
																						return;
																					}
																					void navigate(session.url);
																				}}
																				onContextMenu={(event) =>
																					openContextMenu(event, {
																						type: "session",
																						slug: repo.slug,
																						sessionUrl: session.url,
																					})
																				}
																				variant={
																					isSessionSelected ? "light" : "subtle"
																				}
																			/>
																		);
																	})}
																</Stack>
															</Box>
														</Collapse>
													) : null}
												</Stack>
											);
										})}
									</Stack>
								</ScrollArea>
							</Stack>
						</Box>
					)}
				</SidebarContextMenu>
			</Flex>
		</Flex>
	);
}

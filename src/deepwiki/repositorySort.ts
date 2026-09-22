import type { RepositorySlug } from "@/deepwiki/repository";

// Compare two repository slugs in a case-insensitive manner
export const compareRepositorySlug = (
	left: RepositorySlug,
	right: RepositorySlug,
): number => left.localeCompare(right, "en", { sensitivity: "base" });

type CreatedAtLike = { createdAt: number };

// Compare two objects based on their createdAt property in descending order
export const compareSessionCreatedAt = (
	left: CreatedAtLike,
	right: CreatedAtLike,
): number => right.createdAt - left.createdAt;

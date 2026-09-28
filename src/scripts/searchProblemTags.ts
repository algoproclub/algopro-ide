import Fuse from 'fuse.js';
import { type ProblemTag, problemTags } from '../types/problem';

const tagSearch = new Fuse(problemTags, {
  threshold: 0.35,
  ignoreLocation: true,
});

// Fuse scores a match the same wherever it occurs in the tag, so "dp" ranks
// "bitmask dp" as highly as "dp optimization" and the tie is broken
// alphabetically. Tags that start with the query are what the user most likely
// meant, so they are promoted ahead of the rest of the (stable) Fuse ordering.
const matchRank = (tag: ProblemTag, query: string) => {
  if (tag === query) return 0;
  return tag.startsWith(query) ? 1 : 2;
};

export const searchProblemTags = (
  query: string,
  { exclude = [] }: { exclude?: ProblemTag[] } = {}
): ProblemTag[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const excluded = new Set(exclude);
  const matches = normalizedQuery
    ? tagSearch.search(normalizedQuery).map(result => result.item)
    : problemTags;

  return matches
    .filter(tag => !excluded.has(tag))
    .sort(
      (a, b) => matchRank(a, normalizedQuery) - matchRank(b, normalizedQuery)
    );
};

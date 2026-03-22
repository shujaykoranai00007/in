const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "edit",
  "anime",
  "amv",
  "reel",
  "video",
  "post",
  "official",
  "new",
  "best",
  "hd",
  "full"
]);

const HOOKS = [
  "This anime edit hits different.",
  "POV: your favorite anime scene got a perfect edit.",
  "Pure anime energy in one cut.",
  "This scene deserves a replay."
];

const CTAS = [
  "Rate this from 1-10 in comments.",
  "Save and share with an anime friend.",
  "Comment your favorite character below.",
  "Follow for more daily anime edits."
];

function cleanText(value) {
  return String(value || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^\)]*\)/g, " ")
    .replace(/[|_\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTokens(seedText) {
  return [...new Set(
    cleanText(seedText)
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/[^a-z0-9]/g, ""))
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
  )].slice(0, 6);
}

function toHashTag(word) {
  return `#${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

function chooseBySeed(list, seed) {
  if (!list.length) {
    return "";
  }

  const numericSeed = String(seed || "anime").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return list[numericSeed % list.length];
}

export function generateUploadText({ seedText, existingCaption, postType }) {
  const tokens = extractTokens(seedText);
  const hook = chooseBySeed(HOOKS, seedText);
  const cta = chooseBySeed(CTAS, `${seedText}:${postType}`);

  const keywordPool = tokens.length ? tokens : ["anime", "edit", "amv", "animeclip"];
  const keywords = keywordPool.map((word) => (word.includes("anime") ? word : `anime ${word}`)).slice(0, 6);

  const baseTags = postType === "post"
    ? ["#AnimePost", "#AnimeLovers", "#AnimeEdit", "#OtakuCommunity", "#ExplorePage"]
    : ["#AnimeReels", "#AnimeEdit", "#AMV", "#ReelsInstagram", "#ExplorePage"];

  const tokenTags = keywordPool.map((word) => toHashTag(word.replace(/\s+/g, ""))).slice(0, 5);
  const hashtags = [...new Set([...tokenTags, ...baseTags])].slice(0, 10);

  const captionCore = [
    existingCaption?.trim() || hook,
    cta,
    `Keywords: ${keywords.join(", ")}`,
    hashtags.join(" ")
  ].join("\n\n");

  return {
    caption: captionCore.slice(0, 2200),
    keywords,
    hashtags
  };
}

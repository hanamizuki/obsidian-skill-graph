import en, { type Lang } from "./locale/en";
import zhTW from "./locale/zh-tw";

// Map Obsidian locale codes to translation objects
const localeMap: Record<string, Partial<Lang>> = {
	en,
	"zh-TW": zhTW,
};

// Detect Obsidian's UI language from localStorage (community standard, no official API)
const lang = window.localStorage.getItem("language");
const locale = localeMap[lang ?? "en"];

/**
 * Translate a key to the current locale, falling back to English.
 * TypeScript enforces that only valid keys from en.ts can be used.
 */
export function t(key: keyof Lang): string {
	return (locale && locale[key]) || en[key];
}

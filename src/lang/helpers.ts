import { getLanguage } from "obsidian";
import en, { type Lang } from "./locale/en";
import zhTW from "./locale/zh-tw";

// Map Obsidian locale codes to translation objects
const localeMap: Record<string, Partial<Lang>> = {
	en,
	"zh-TW": zhTW,
};

// Detect Obsidian's UI language via the official getLanguage() API
// (available since Obsidian 1.8.7). It returns the ISO language code the
// user selected (e.g. "en", "zh-TW"), matching the localeMap keys, and
// defaults to "en" when unset — so behavior is identical to the previous
// localStorage.getItem("language") read.
const lang = getLanguage();
const locale = localeMap[lang];

/**
 * Translate a key to the current locale, falling back to English.
 * TypeScript enforces that only valid keys from en.ts can be used.
 */
export function t(key: keyof Lang): string {
	return (locale && locale[key]) || en[key];
}

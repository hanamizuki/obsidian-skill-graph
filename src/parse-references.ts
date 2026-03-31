/**
 * 從 SKILL.md 內文中提取引用的相對檔案路徑。
 * 純函式，不依賴 Obsidian API，完全可單元測試。
 *
 * 支援三種路徑格式：
 * 1. 反引號包圍的路徑：`references/SCHEMA.md`
 * 2. Markdown 連結目標：[文字](references/forms.md)
 * 3. CLI 指令後的路徑：python3/bash/node/sh scripts/run.sh
 *
 * 忽略的路徑類型：
 * - 絕對路徑（以 / 開頭）
 * - 以 ~ 開頭的路徑（如 ~/.openclaw/skills/...）
 * - URL（https://... 等）
 * - .openclaw/skills/ 路徑（由其他模組另行處理）
 */
export function parseReferences(text: string): string[] {
	const paths = new Set<string>();

	// 模式 1：反引號路徑 `references/SCHEMA.md`
	const backtickRegex = /`([^`\n]+)`/g;
	for (const match of text.matchAll(backtickRegex)) {
		const p = match[1]!;
		if (isIgnored(p)) continue;
		const cleaned = stripBaseDir(p);
		if (looksLikeFilePath(cleaned)) {
			paths.add(cleaned);
		}
	}

	// 模式 2：Markdown 連結 [text](path)
	const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
	for (const match of text.matchAll(mdLinkRegex)) {
		const p = match[2]!;
		if (isIgnored(p)) continue;
		const cleaned = stripBaseDir(p);
		if (looksLikeFilePath(cleaned)) {
			paths.add(cleaned);
		}
	}

	// 模式 3：CLI 指令後的路徑 (python3/bash/node/sh + path)
	const cliRegex = /(?:python3?|bash|node|sh)\s+([\w.{}/.-]+\.\w+)/g;
	for (const match of text.matchAll(cliRegex)) {
		const p = match[1]!;
		if (isIgnored(p)) continue;
		const cleaned = stripBaseDir(p);
		if (looksLikeFilePath(cleaned)) {
			paths.add(cleaned);
		}
	}

	return [...paths];
}

/** 移除 {baseDir}/ 前綴，讓所有模式統一取得相對路徑 */
function stripBaseDir(p: string): string {
	return p.replace(/^\{baseDir\}\//, "");
}

/** 判斷是否為應忽略的路徑 */
function isIgnored(p: string): boolean {
	// 忽略 URL
	if (/^https?:\/\//.test(p)) return true;
	// 忽略絕對路徑
	if (p.startsWith("/")) return true;
	// 忽略 ~ 開頭（home dir 路徑，含 .openclaw/skills/）
	if (p.startsWith("~")) return true;
	// 忽略 .openclaw/skills/ 路徑（由其他模組另行處理）
	if (p.includes(".openclaw/skills/")) return true;
	return false;
}

/** 判斷字串是否看起來像檔案路徑（含目錄分隔和副檔名） */
function looksLikeFilePath(p: string): boolean {
	return p.includes("/") && /\.\w+$/.test(p);
}

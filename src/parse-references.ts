/**
 * 從 SKILL.md 內文中提取引用的檔案路徑。
 * 純函式，不依賴 Obsidian API，完全可單元測試。
 *
 * 回傳兩類路徑：
 * - relativePaths: 相對路徑（可直接或經 resolver 對應到 vault 內檔案）
 * - absolutePaths: 絕對路徑（需由 skill-parser 比對 vault 前綴後轉換）
 */
export interface ParseResult {
	relativePaths: string[];
	absolutePaths: string[];
}

export function parseReferences(text: string): ParseResult {
	const relativePaths = new Set<string>();
	const absolutePaths = new Set<string>();

	// 收集候選路徑的共用函式
	const collect = (p: string) => {
		// 忽略 URL
		if (/^https?:\/\//.test(p)) return;
		// 忽略 ~ 開頭（home dir）
		if (p.startsWith("~")) return;
		// 忽略 .openclaw/skills/（由其他模組處理）
		if (p.includes(".openclaw/skills/")) return;

		// 絕對路徑：收集到 absolutePaths，交給 skill-parser 處理
		if (p.startsWith("/")) {
			if (looksLikeFilePath(p)) {
				absolutePaths.add(p);
			}
			return;
		}

		// 相對路徑：去掉 {baseDir}/ 前綴
		const cleaned = p.replace(/^\{baseDir\}\//, "");
		if (looksLikeFilePath(cleaned)) {
			relativePaths.add(cleaned);
		}
	};

	// 模式 1：反引號路徑 `references/SCHEMA.md`
	const backtickRegex = /`([^`\n]+)`/g;
	for (const match of text.matchAll(backtickRegex)) {
		collect(match[1]!);
	}

	// 模式 2：Markdown 連結 [text](path)
	const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
	for (const match of text.matchAll(mdLinkRegex)) {
		collect(match[2]!);
	}

	// 模式 3：CLI 指令後的路徑 (python3/bash/node/sh + path)
	const cliRegex = /(?:python3?|bash|node|sh)\s+([\w.{}/.-]+\.\w+)/g;
	for (const match of text.matchAll(cliRegex)) {
		collect(match[1]!);
	}

	return {
		relativePaths: [...relativePaths],
		absolutePaths: [...absolutePaths],
	};
}

/** 判斷字串是否看起來像檔案路徑（含目錄分隔和副檔名） */
function looksLikeFilePath(p: string): boolean {
	return p.includes("/") && /\.\w+$/.test(p);
}

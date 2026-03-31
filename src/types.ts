// === Skill data structures ===

/** 一個 SKILL.md 解析出的完整資訊 */
export interface SkillInfo {
	/** vault 內的相對路徑，如 "content-planner/SKILL.md" */
	filePath: string;
	/** frontmatter 的 name 欄位值 */
	displayName: string;
	/** vault 內被引用的檔案路徑（已確認存在） */
	references: string[];
	/** vault 外的引用路徑（解析失敗，檔案不在 vault 內） */
	unresolvedRefs: string[];
}

// === Obsidian undocumented API type extensions ===
// 實測得知：graph 用 PixiJS 渲染（WebGL），非 SVG DOM

/** PixiJS Text 物件（簡化定義） */
export interface PixiText {
	/** 實際顯示的文字 */
	_text: string;
	/** 標記文字需要重新渲染 */
	dirty: boolean;
}

/** Graph renderer node（未公開 API） */
export interface GraphNode {
	id: string;
	/** 回傳顯示名稱（不含副檔名的檔名） */
	getDisplayText(): string;
	/** PixiJS Text 物件，存放實際渲染的文字 */
	text: PixiText;
	/** 節點顏色，格式為 { a: 1, rgb: 0xRRGGBB } 或 null（用預設色） */
	color: { a: number; rgb: number } | null;
	/** patch 標記，避免重複覆寫 */
	_skillGraphPatched?: boolean;
	/** 儲存原始的顯示文字，cleanup 時恢復 */
	_originalDisplayText?: string;
}

/** Graph renderer（未公開 API） */
export interface GraphRenderer {
	nodes: GraphNode[];
	/** 邊的陣列，實際屬性名是 links */
	links: GraphLink[];
}

/** Graph link/edge（未公開 API） */
export interface GraphLink {
	source: GraphNode;
	target: GraphNode;
	/** plugin 注入的邊標記，cleanup 時用來過濾移除 */
	_skillGraphInjected?: boolean;
}

/** Graph view（未公開 API） */
export interface GraphView {
	renderer?: GraphRenderer;
	getDisplayText(): string;
	getViewType(): string;
}

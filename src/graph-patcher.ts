import { App, WorkspaceLeaf } from "obsidian";
import type { SkillInfo, GraphNode, GraphRenderer, GraphView } from "./types";
import type { SkillGraphSettings } from "./settings";

/**
 * Hook Obsidian 的 Graph View renderer，
 * 覆寫節點名稱並依類型上色。
 * 實測得知 graph 用 PixiJS 渲染，文字存在 node.text._text，顏色存在 node.color。
 */
export class GraphPatcher {
	private app: App;
	private skillMap: Map<string, SkillInfo>;
	private settings: SkillGraphSettings;
	/** 所有被 skill 引用的 vault 內檔案路徑 */
	private localRefPaths: Set<string> = new Set();
	/** 所有被 skill 引用的 vault 外檔案路徑（unresolvedLinks 注入的） */
	private externalRefPaths: Set<string> = new Set();

	constructor(app: App, skillMap: Map<string, SkillInfo>, settings: SkillGraphSettings) {
		this.app = app;
		this.skillMap = skillMap;
		this.settings = settings;
	}

	/** 更新設定 */
	updateSettings(settings: SkillGraphSettings): void {
		this.settings = settings;
	}

	/** 重新計算引用路徑集合 */
	private refreshRefPaths(): void {
		this.localRefPaths.clear();
		this.externalRefPaths.clear();
		for (const info of this.skillMap.values()) {
			for (const ref of info.references) {
				this.localRefPaths.add(ref);
			}
			for (const ext of info.unresolvedRefs) {
				this.externalRefPaths.add(ext);
			}
		}
	}

	/** 掃描所有 graph/localgraph leaf 並 patch */
	patchAllGraphs(): void {
		this.refreshRefPaths();
		const graphLeaves = [
			...this.app.workspace.getLeavesOfType("graph"),
			...this.app.workspace.getLeavesOfType("localgraph"),
		];
		for (const leaf of graphLeaves) {
			this.patchGraphLeaf(leaf);
		}
	}

	/** Patch 單一 graph leaf 的 renderer */
	private patchGraphLeaf(leaf: WorkspaceLeaf): void {
		const view = leaf.view as unknown as GraphView;
		const renderer = view?.renderer;
		if (!renderer?.nodes) return;

		// 顏色格式為 { a: 1, rgb: 0xRRGGBB }
		this.patchNodes(renderer);
	}

	/** 覆寫節點名稱 + 上色 */
	private patchNodes(renderer: GraphRenderer): void {
		for (const node of renderer.nodes) {
			// 節點改名：只對 SKILL.md 節點
			if (!node._skillGraphPatched) {
				const skillInfo = this.skillMap.get(node.id);
				if (skillInfo) {
					// 儲存原始文字，cleanup 時恢復
					node._originalDisplayText = node.text._text;
					// 直接修改 PixiJS Text 物件的文字內容
					node.text._text = skillInfo.displayName;
					node.text.dirty = true;
					node.getDisplayText = () => skillInfo.displayName;
					node._skillGraphPatched = true;
				}
			}

			// 上色：每次都重新套用（因為 renderer 可能重設顏色）
			const nodeType = this.getNodeType(node);
			if (nodeType) {
				node.color = { a: 1, rgb: this.hexToInt(this.getColorForType(nodeType)) };
			}
		}
	}

	/** 判斷節點類型 */
	private getNodeType(node: GraphNode): "skill" | "local-ref" | "external-ref" | null {
		if (this.skillMap.has(node.id)) return "skill";
		if (this.localRefPaths.has(node.id)) return "local-ref";
		if (this.externalRefPaths.has(node.id)) return "external-ref";
		return null;
	}

	/** 依類型回傳顏色 hex string */
	private getColorForType(type: "skill" | "local-ref" | "external-ref"): string {
		switch (type) {
			case "skill":
				return this.settings.colorSkill;
			case "local-ref":
				return this.settings.colorLocalRef;
			case "external-ref":
				return this.settings.colorExternalRef;
		}
	}

	/** 將 hex 色碼轉為整數格式（0xRRGGBB） */
	private hexToInt(hex: string): number {
		return parseInt(hex.replace("#", ""), 16);
	}

	/** 清除所有 patch，恢復原始狀態（plugin unload 時用） */
	cleanup(): void {
		const graphLeaves = [
			...this.app.workspace.getLeavesOfType("graph"),
			...this.app.workspace.getLeavesOfType("localgraph"),
		];
		for (const leaf of graphLeaves) {
			const view = leaf.view as unknown as GraphView;
			const renderer = view?.renderer;
			if (!renderer?.nodes) continue;

			for (const node of renderer.nodes) {
				if (node._originalDisplayText !== undefined) {
					node.text._text = node._originalDisplayText;
					node.text.dirty = true;
				}
				delete node._skillGraphPatched;
				delete node._originalDisplayText;
			}
		}
	}
}

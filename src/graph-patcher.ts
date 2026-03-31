import { App, WorkspaceLeaf } from "obsidian";
import type { SkillInfo, GraphNode, GraphRenderer, GraphView } from "./types";

/**
 * Hook Obsidian 的 Graph View renderer，
 * 覆寫節點名稱並注入技能引用的邊。
 */
export class GraphPatcher {
	private app: App;
	private skillMap: Map<string, SkillInfo>;

	constructor(app: App, skillMap: Map<string, SkillInfo>) {
		this.app = app;
		this.skillMap = skillMap;
	}

	/** 掃描所有 graph/localgraph leaf 並 patch */
	patchAllGraphs(): void {
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

		this.patchNodeNames(renderer);
		this.injectEdges(renderer);
	}

	/** 覆寫 SKILL.md 節點的 getDisplayText */
	private patchNodeNames(renderer: GraphRenderer): void {
		for (const node of renderer.nodes) {
			if (node._skillGraphPatched) continue;

			const skillInfo = this.skillMap.get(node.id);
			if (skillInfo) {
				// 儲存原始函式，cleanup 時恢復
				node._originalGetDisplayText = node.getDisplayText.bind(node);
				const displayName = skillInfo.displayName;
				node.getDisplayText = () => displayName;
				node._skillGraphPatched = true;
			}
		}
	}

	/** 注入 SKILL.md → 引用檔案的邊（vault 內） */
	private injectEdges(renderer: GraphRenderer): void {
		// 建立 node id → node 的查找表
		const nodeById = new Map<string, GraphNode>();
		for (const node of renderer.nodes) {
			nodeById.set(node.id, node);
		}

		for (const [filePath, skillInfo] of this.skillMap) {
			const sourceNode = nodeById.get(filePath);
			if (!sourceNode) continue;

			for (const refPath of skillInfo.references) {
				const targetNode = nodeById.get(refPath);
				if (!targetNode) continue;

				// 檢查是否已有這條邊
				const edgeExists = renderer.edges.some(
					(e) => e.source === sourceNode && e.target === targetNode
				);
				if (!edgeExists) {
					renderer.edges.push({
						source: sourceNode,
						target: targetNode,
					});
				}
			}
		}
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
				// 恢復原始的 getDisplayText
				if (node._originalGetDisplayText) {
					node.getDisplayText = node._originalGetDisplayText;
				}
				delete node._skillGraphPatched;
				delete node._originalGetDisplayText;
			}
		}
	}
}

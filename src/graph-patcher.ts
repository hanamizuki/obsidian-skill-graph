import { App, WorkspaceLeaf } from "obsidian";
import type { SkillInfo, GraphNode, GraphRenderer, GraphView } from "./types";
import type { SkillGraphSettings } from "./settings";

/**
 * Hooks into Obsidian's Graph View renderer to override node labels
 * and apply per-type colors.
 * Confirmed via inspection: graph uses PixiJS (WebGL); text is in node.text._text,
 * color is in node.color.
 */
export class GraphPatcher {
	private app: App;
	private skillMap: Map<string, SkillInfo>;
	private settings: SkillGraphSettings;
	/** All in-vault file paths referenced by any skill */
	private localRefPaths: Set<string> = new Set();
	/** All out-of-vault file paths referenced by any skill (injected via unresolvedLinks) */
	private externalRefPaths: Set<string> = new Set();
	/** Display names for external refs (from frontmatter) */
	private externalDisplayNames: Map<string, string> = new Map();

	constructor(app: App, skillMap: Map<string, SkillInfo>, settings: SkillGraphSettings) {
		this.app = app;
		this.skillMap = skillMap;
		this.settings = settings;
	}

	/** Update settings */
	updateSettings(settings: SkillGraphSettings): void {
		this.settings = settings;
	}

	/** Rebuild the reference path sets and external display names from the current skill map */
	private refreshRefPaths(): void {
		this.localRefPaths.clear();
		this.externalRefPaths.clear();
		this.externalDisplayNames.clear();
		for (const info of this.skillMap.values()) {
			for (const ref of info.references) {
				this.localRefPaths.add(ref);
			}
			for (const ext of info.unresolvedRefs) {
				this.externalRefPaths.add(ext);
			}
			for (const [path, name] of info.externalDisplayNames) {
				this.externalDisplayNames.set(path, name);
			}
		}
	}

	/** Patch all open graph and localgraph leaves */
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

	/** Patch the renderer of a single graph leaf */
	private patchGraphLeaf(leaf: WorkspaceLeaf): void {
		const view = leaf.view as unknown as GraphView;
		const renderer = view?.renderer;
		if (!renderer?.nodes) return;

		this.patchNodes(renderer);
		this.hookRenderCallback(renderer);
	}

	/**
	 * Hook into the renderer's render callback so colors are applied on every frame.
	 * Without this, the renderer resets node.color during animation, causing flicker.
	 */
	private hookRenderCallback(renderer: GraphRenderer): void {
		const r = renderer as any;
		if (r._skillGraphRenderHooked) return;

		const originalCallback = r.renderCallback;
		if (typeof originalCallback !== "function") return;

		const self = this;
		r.renderCallback = function (...args: unknown[]) {
			originalCallback.apply(this, args);
			// Re-apply colors after the renderer's own render pass
			self.applyColors(renderer);
		};
		r._skillGraphRenderHooked = true;
	}

	/** Override node labels (once) and apply colors */
	private patchNodes(renderer: GraphRenderer): void {
		for (const node of renderer.nodes) {
			// Rename: only apply once per node
			if (!node._skillGraphPatched) {
				// Check if this is a SKILL.md node (in skillMap)
				const skillInfo = this.skillMap.get(node.id);
				if (skillInfo) {
					node._originalDisplayText = node.text._text;
					node.text._text = skillInfo.displayName;
					node.text.dirty = true;
					node.getDisplayText = () => skillInfo.displayName;
					node._skillGraphPatched = true;
				}
				// Check if this is an external ref with a known display name
				const extName = this.externalDisplayNames.get(node.id);
				if (extName) {
					node._originalDisplayText = node.text._text;
					node.text._text = extName;
					node.text.dirty = true;
					node.getDisplayText = () => extName;
					node._skillGraphPatched = true;
				}
			}
		}
		this.applyColors(renderer);
	}

	/** Apply colors to all nodes — called on every render frame via hookRenderCallback */
	private applyColors(renderer: GraphRenderer): void {
		for (const node of renderer.nodes) {
			const nodeType = this.getNodeType(node);
			if (nodeType) {
				node.color = { a: 1, rgb: this.hexToInt(this.getColorForType(nodeType)) };
			}
		}
	}

	/** Determine the type of a graph node */
	private getNodeType(node: GraphNode): "skill" | "local-ref" | "external-ref" | null {
		if (this.skillMap.has(node.id)) return "skill";
		if (this.localRefPaths.has(node.id)) return "local-ref";
		if (this.externalRefPaths.has(node.id)) return "external-ref";
		return null;
	}

	/** Return the hex color string for a given node type */
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

	/** Convert a hex color string to an integer (0xRRGGBB) */
	private hexToInt(hex: string): number {
		return parseInt(hex.replace("#", ""), 16);
	}

	/** Remove all patches and restore original state (called on plugin unload) */
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

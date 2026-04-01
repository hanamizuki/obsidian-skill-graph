// === Skill data structures ===

/** All parsed information from a single SKILL.md file */
export interface SkillInfo {
	/** Relative path within the vault, e.g. "content-planner/SKILL.md" */
	filePath: string;
	/** Value of the name field in frontmatter */
	displayName: string;
	/** Paths of referenced files confirmed to exist inside the vault */
	references: string[];
	/** Reference paths that could not be resolved to a file inside the vault */
	unresolvedRefs: string[];
	/** Display names for unresolved refs (read from external file frontmatter) */
	externalDisplayNames: Map<string, string>;
}

// === Obsidian undocumented API type extensions ===
// Confirmed via inspection: graph is rendered with PixiJS (WebGL), not SVG DOM

/** PixiJS Text object (simplified definition) */
export interface PixiText {
	/** The text string currently displayed */
	_text: string;
	/** Marks the text as needing re-render */
	dirty: boolean;
}

/** Graph renderer node (undocumented API) */
export interface GraphNode {
	id: string;
	/** Returns the display name (filename without extension) */
	getDisplayText(): string;
	/** PixiJS Text object holding the rendered label */
	text: PixiText;
	/** Node color in { a: 1, rgb: 0xRRGGBB } format, or null for default */
	color: { a: number; rgb: number } | null;
	/** Patch marker to prevent double-patching */
	_skillGraphPatched?: boolean;
	/** Stores the original display text for restoration on cleanup */
	_originalDisplayText?: string;
}

/** Color value used by the PixiJS-based graph renderer */
export interface RendererColor {
	a: number;
	rgb: number;
}

/** Graph renderer (undocumented API) */
export interface GraphRenderer {
	nodes: GraphNode[];
	/** Array of edges; actual property name is links */
	links: GraphLink[];
	/** Theme colors used by the renderer for default node fills */
	colors?: {
		fill: RendererColor;
		fillUnresolved: RendererColor;
		fillFocused: RendererColor;
		fillTag: RendererColor;
		fillAttachment: RendererColor;
		[key: string]: RendererColor;
	};
	/** Called on each render frame; can be wrapped to inject per-frame logic */
	renderCallback?: (...args: unknown[]) => void;
	/** Marker set by the plugin to avoid hooking renderCallback twice */
	_skillGraphRenderHooked?: boolean;
}

/** Graph link/edge (undocumented API) */
export interface GraphLink {
	source: GraphNode;
	target: GraphNode;
	/** Marker for plugin-injected edges, used to filter them out on cleanup */
	_skillGraphInjected?: boolean;
}

/** Graph view (undocumented API) */
export interface GraphView {
	renderer?: GraphRenderer;
	getDisplayText(): string;
	getViewType(): string;
}

// === Obsidian module augmentation for undocumented APIs ===

declare module "obsidian" {
	interface MetadataCache {
		unresolvedLinks: Record<string, Record<string, number>>;
	}
	interface FileSystemAdapter {
		basePath: string;
	}
}

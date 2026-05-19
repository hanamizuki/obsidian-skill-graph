import { describe, it, expect } from "vitest";
import { GraphPatcher } from "../src/graph-patcher";
import type { SkillGraphSettings } from "../src/settings";
import type { GraphRenderer, GraphNode, SkillInfo } from "../src/types";

const settings: SkillGraphSettings = {
	skillFileName: "SKILL.md",
	skillsFolder: "skills",
	nameField: "name",
	colorSkill: "#DE7356",
	colorAgent: "#7BAE6F",
	colorLocalRef: "#5B8CA4",
	colorExternalRef: "#DBDBDB",
};

/** A real skill node the patcher should rename + recolor. */
function makeSkillNode(): GraphNode {
	return {
		id: "skills/foo/SKILL.md",
		text: { _text: "SKILL", dirty: false },
		getDisplayText() {
			return "SKILL";
		},
		color: null,
	} as GraphNode;
}

/** A populated skill map matching the SkillInfo type. */
function makeSkillMap(): Map<string, SkillInfo> {
	return new Map<string, SkillInfo>([
		[
			"skills/foo/SKILL.md",
			{
				filePath: "skills/foo/SKILL.md",
				displayName: "Foo",
				kind: "skill",
				references: [],
				unresolvedRefs: [],
				externalDisplayNames: new Map(),
			},
		],
	]);
}

/**
 * Build a minimal fake renderer + leaf + app the patcher can operate on.
 *
 * @param opts.withNode  add a real skill node to renderer.nodes
 * @param opts.withLocalGraph  also expose a separate "localgraph" leaf+renderer
 */
function makeHarness(opts?: { withNode?: boolean; withLocalGraph?: boolean }) {
	function buildRenderer() {
		const originalCallback = function originalRenderCallback() {};
		const originalFillUnresolved = { a: 1, rgb: 0x111111 };
		const renderer = {
			nodes: opts?.withNode ? [makeSkillNode()] : [],
			links: [],
			colors: {
				fill: { a: 1, rgb: 0 },
				fillUnresolved: { ...originalFillUnresolved },
				fillFocused: { a: 1, rgb: 0 },
				fillTag: { a: 1, rgb: 0 },
				fillAttachment: { a: 1, rgb: 0 },
			},
			renderCallback: originalCallback,
		} as unknown as GraphRenderer;
		return { renderer, originalCallback, originalFillUnresolved };
	}

	const graph = buildRenderer();
	const graphLeaf = { view: { renderer: graph.renderer } };

	const localGraph = opts?.withLocalGraph ? buildRenderer() : undefined;
	const localGraphLeaf = localGraph
		? { view: { renderer: localGraph.renderer } }
		: undefined;

	const app = {
		workspace: {
			getLeavesOfType: (type: string) => {
				if (type === "graph") return [graphLeaf];
				if (type === "localgraph" && localGraphLeaf)
					return [localGraphLeaf];
				return [];
			},
		},
	};

	return {
		app,
		renderer: graph.renderer,
		originalCallback: graph.originalCallback,
		originalFillUnresolved: graph.originalFillUnresolved,
		localRenderer: localGraph?.renderer,
		localOriginalCallback: localGraph?.originalCallback,
	};
}

describe("GraphPatcher.cleanup", () => {
	it("restores renderCallback, the hook marker, and fillUnresolved", () => {
		const { app, renderer, originalCallback, originalFillUnresolved } =
			makeHarness();
		const patcher = new GraphPatcher(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			app as any,
			new Map(),
			settings
		);

		patcher.patchAllGraphs();

		// Sanity: the patch actually took effect.
		expect(renderer.renderCallback).not.toBe(originalCallback);
		expect(renderer._skillGraphRenderHooked).toBe(true);
		expect(renderer.colors!.fillUnresolved.rgb).not.toBe(
			originalFillUnresolved.rgb
		);

		patcher.cleanup();

		// After cleanup the renderer must be exactly as we found it: a
		// disabled plugin must not keep recoloring nodes every frame.
		expect(renderer.renderCallback).toBe(originalCallback);
		expect(renderer._skillGraphRenderHooked).toBeFalsy();
		expect(renderer.colors!.fillUnresolved).toEqual(
			originalFillUnresolved
		);
	});

	it("renames a skill node and fully restores text + getDisplayText", () => {
		const { app, renderer } = makeHarness({ withNode: true });
		const node = renderer.nodes[0];
		const patcher = new GraphPatcher(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			app as any,
			makeSkillMap(),
			settings
		);

		patcher.patchAllGraphs();

		// The patch renames both the rendered text and the closure.
		expect(node.text._text).toBe("Foo");
		expect(node.getDisplayText()).toBe("Foo");

		patcher.cleanup();

		// Cleanup must restore BOTH, otherwise the plugin's closure stays
		// resident on the node and re-applies the name on re-layout/hover.
		expect(node.text._text).toBe("SKILL");
		expect(node.getDisplayText()).toBe("SKILL");
	});

	it("saves the true original once across repeated patch passes", () => {
		const { app, renderer, originalCallback, originalFillUnresolved } =
			makeHarness();
		const patcher = new GraphPatcher(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			app as any,
			new Map(),
			settings
		);

		// Patching twice must not capture our own injected color/callback as
		// the "original" on the second pass.
		patcher.patchAllGraphs();
		patcher.patchAllGraphs();
		patcher.cleanup();

		expect(renderer.colors!.fillUnresolved).toEqual(originalFillUnresolved);
		expect(renderer.renderCallback).toBe(originalCallback);
	});

	it("restores fillUnresolved by object identity (saved by reference)", () => {
		const { app, renderer } = makeHarness();
		const patcher = new GraphPatcher(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			app as any,
			new Map(),
			settings
		);

		// Save-by-reference is intentional: cleanup must put back the exact
		// same object the renderer originally held, not a clone.
		const before = renderer.colors!.fillUnresolved;

		patcher.patchAllGraphs();
		patcher.cleanup();

		expect(renderer.colors!.fillUnresolved).toBe(before);
	});

	it("restores every open leaf and is a safe no-op when called again", () => {
		const {
			app,
			renderer,
			originalCallback,
			localRenderer,
			localOriginalCallback,
		} = makeHarness({ withLocalGraph: true });
		const patcher = new GraphPatcher(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			app as any,
			new Map(),
			settings
		);

		patcher.patchAllGraphs();
		patcher.cleanup();

		// Both the graph and localgraph renderers must be restored.
		expect(renderer.renderCallback).toBe(originalCallback);
		expect(renderer._skillGraphRenderHooked).toBeFalsy();
		expect(localRenderer!.renderCallback).toBe(localOriginalCallback);
		expect(localRenderer!._skillGraphRenderHooked).toBeFalsy();

		// A second cleanup with nothing left to restore must not throw and
		// must leave the already-restored callbacks untouched.
		expect(() => patcher.cleanup()).not.toThrow();
		expect(renderer.renderCallback).toBe(originalCallback);
		expect(renderer._skillGraphOriginalRenderCallback).toBeUndefined();
		expect(localRenderer!.renderCallback).toBe(localOriginalCallback);
		expect(
			localRenderer!._skillGraphOriginalRenderCallback
		).toBeUndefined();
	});
});

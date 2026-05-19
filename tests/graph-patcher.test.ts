import { describe, it, expect } from "vitest";
import { GraphPatcher } from "../src/graph-patcher";
import type { SkillGraphSettings } from "../src/settings";
import type { GraphRenderer } from "../src/types";

const settings: SkillGraphSettings = {
	skillFileName: "SKILL.md",
	skillsFolder: "skills",
	nameField: "name",
	colorSkill: "#DE7356",
	colorAgent: "#7BAE6F",
	colorLocalRef: "#5B8CA4",
	colorExternalRef: "#DBDBDB",
};

/** Build a minimal fake renderer + leaf + app the patcher can operate on. */
function makeHarness() {
	const originalCallback = function originalRenderCallback() {};
	const originalFillUnresolved = { a: 1, rgb: 0x111111 };
	const renderer = {
		nodes: [],
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

	const leaf = { view: { renderer } };
	const app = {
		workspace: {
			getLeavesOfType: (type: string) =>
				type === "graph" ? [leaf] : [],
		},
	};
	return { app, renderer, originalCallback, originalFillUnresolved };
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
});

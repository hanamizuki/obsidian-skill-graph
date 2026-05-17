// Runtime stub for the `obsidian` package.
//
// The published `obsidian` npm package is types-only (empty `main`), so it
// cannot be imported at runtime. The production bundle marks it external
// (Obsidian provides it at load time). For unit tests we alias `obsidian` to
// this file (see vitest.config.ts) so modules importing from it can load.
//
// Only the symbols referenced by the code under test are stubbed.

export class App {}
export class FileSystemAdapter {}
export class TFile {}
export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export class WorkspaceLeaf {}

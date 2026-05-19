# Agent Skill Graph

An Obsidian plugin to visualize OpenClaw / Claude Code agent skill structures in graph view.

https://github.com/user-attachments/assets/2fabeea0-eb33-42d8-ae9d-2bf06fa884f0

In Graph View:
- SKILL.md nodes display the frontmatter `name` value (instead of the filename "SKILL")
- Files referenced inside SKILL.md are automatically parsed and connected with edges
- Nodes are colored by type (skill root node vs. referenced files)

Read-only — no original files are modified. All changes are in-memory and revert when the plugin is disabled.

## Getting Started

### 1. Create a vault from your skills directory

Open Obsidian → **Open folder as vault** → select your agent's skills directory.

For example:
- OpenClaw: `~/OpenClaw/mojo/skills/` or `~/OpenClaw/harbs/skills/`
- Claude Code: `~/.claude/skills/`

Each skill subdirectory should contain a `SKILL.md` file with YAML frontmatter including a `name` field.

### 2. Install the plugin

Clone or download this repository, then symlink it into your vault's plugins folder:

```bash
# Build the plugin first
cd <path-to-this-repo>
npm install && npm run build

# Symlink into your vault
mkdir -p <vault>/.obsidian/plugins
ln -s <path-to-this-repo> <vault>/.obsidian/plugins/obsidian-skill-graph
```

### 3. Enable the plugin

In Obsidian: Settings → Community plugins → Turn on community plugins → enable **Agent Skill Graph**

### 4. Open Graph View

Press `Cmd+P` (or `Ctrl+P`) → search "Open graph view" → Enter. You should see skill nodes renamed and colored.

### Development

```bash
npm install
npm run dev    # watch mode — rebuilds automatically on change
npm run build  # production build
npm test       # run unit tests
```

## Settings

Settings → Community plugins → Agent Skill Graph (gear icon)

| Setting | Default | Description |
|---------|---------|-------------|
| Skill file name | `SKILL.md` | Filename to scan |
| Skills folder | `skills` | Folder whose direct `.md` children are also treated as skill nodes (empty to disable the folder rule) |
| Name field | `name` | Frontmatter field used as the node label |
| Skill node color | `#DE7356` | Color for SKILL.md nodes |
| Agent node color | `#7BAE6F` | Color for agent nodes (`type: agent` in frontmatter) |
| Reference node color | `#5B8CA4` | Color for referenced files inside the vault |
| External reference color | `#DBDBDB` | Color for referenced files outside the vault |

Enter hex color codes (e.g. `#ff6b6b`). Changes take effect after reopening Graph View.

The plugin UI is localized in English and 正體中文 (Traditional Chinese), auto-selected from Obsidian's display language via the `getLanguage()` API.

## Tips: Multi-Directory Vault with Symlinks

If your skills are spread across multiple directories, you can use symlinks to consolidate them into a single Obsidian vault.

This is common when:
- **OpenClaw** agents each have their own skill directory (e.g. `~/OpenClaw/agent-a/skills/`, `~/OpenClaw/agent-b/skills/`)
- **Claude Code** has both global skills (`~/.claude/skills/`) and project-level skills (`.claude/skills/` inside a repo)

### Setup

Create a dedicated directory and symlink each skill source:

```bash
mkdir ~/skill-vault
cd ~/skill-vault

# Example: OpenClaw agents
ln -s ~/OpenClaw/.openclaw/skills   global
ln -s ~/OpenClaw/agent-a/skills     agent-a
ln -s ~/OpenClaw/agent-b/skills     agent-b

# Example: Claude Code
ln -s ~/.claude/skills              claude-global
ln -s ~/my-project/.claude/skills   my-project
```

Then open `~/skill-vault` as an Obsidian vault.

> **Important:** Obsidian ignores directories starting with `.` (dotfiles). Use plain names like `global` instead of `.openclaw` for your symlink names.

### Editing skills through the symlink

Edits you make in this symlinked vault write straight back to the original skill files — there is no copy and no separate sync step.

This works because the plugin never writes to disk. It only *reads* skill files (`vault.cachedRead`) and *reads* external frontmatter (`fs.readFileSync`); all of its renaming, coloring, and edge work is in-memory Graph View state. Editing file content is therefore plain Obsidian behavior: because each skill directory is symlinked in, Obsidian writes through the symlink to the real source file, and the change takes effect there immediately.

Concretely:

- Edit a skill's body or frontmatter in Obsidian → the real file under the symlink target is updated right away.
- Change the frontmatter `name` → the graph re-parses on the `metadataCache` change event and the node label updates live. The file itself keeps its name (e.g. `SKILL.md`); the plugin never renames files on disk.

**Exception:** this applies only to files that are *inside* the vault (including the real files reached through your symlinks). It does **not** apply to out-of-vault [external virtual nodes](#out-of-vault-paths-become-external-virtual-nodes) — those are read-only placeholders. Clicking one creates a blank note instead of opening the source (see [Known Limitations](#known-limitations)).

## Companion Tool: skill-graph-builder

The agent↔skill vault this plugin visualizes is best produced by **[skill-graph-builder](https://github.com/hanamizuki/skill-graph-builder)** — a framework-agnostic CLI/skill that scans your AI agent platforms (Claude Code, Codex, OpenClaw, Hermes) with zero configuration and emits a ready-to-open Obsidian vault.

It is the **producer**; this plugin is the **consumer / viewer**. The two form a producer→consumer workflow with **no code coupling** — each works independently, but they are designed to be used together. Both are MIT-licensed.

The generated vault uses the flat atomic model this plugin already understands:

- `<vault>/skills/<id>.md` — one node per skill (a symlink to the real `SKILL.md`, deduplicated across sources and agents)
- `<vault>/agents/<platform>-<profile>.md` — one node per agent, linking to every skill it can access

### Quick start

1. Get skill-graph-builder — drop it into your agent's skill directory, or run its Python CLI directly. (Claude Code / Codex paths need no dependencies — pure standard library; Hermes / OpenClaw additionally need optional PyYAML.)
2. Run it to generate the vault.
3. Open that vault in Obsidian and enable this plugin (see [Getting Started](#getting-started)).
4. Open Graph View — the agent↔skill relationships render as a graph.

## How It Works

### Skill Node Detection

A node is recognized as a *skill* node by **either** of two additive rules:

1. **Exact filename match** — the file is named exactly the configured *Skill file name* (default `SKILL.md`). This is the classic per-skill layout where each skill directory contains its own `SKILL.md`.
2. **Skills folder** — the file is a `.md` file located *directly* inside the configured *Skills folder* (default `skills`). This supports flat vaults such as the ones produced by `skill-manager-sync`, where every skill is a `skills/<atomic-id>.md` symlink and no file is literally named `SKILL.md`.

The two rules are OR'd, so classic vaults keep working unchanged. Setting *Skills folder* to an empty string disables rule 2 (pure legacy exact-filename behavior). Detection is path/name based only (vault-relative parent path); no symlinks are resolved and no files are read from disk for this check.

### Node Renaming

Obsidian's Graph View renders with PixiJS (WebGL). The plugin listens to the `layout-change` event, scans `renderer.nodes`, and replaces the `text._text` property (a PixiJS Text object) of each SKILL.md node with the frontmatter `name` value. It also overrides `getDisplayText()` so other consumers receive the correct name.

### Edges

The plugin injects SKILL.md → referenced-file entries into Obsidian's internal link tables, which Graph View reads to create PixiJS link objects:

- **In-vault references** go into `metadataCache.resolvedLinks` — drawn as solid edges to real file nodes.
- **Out-of-vault references** go into `metadataCache.unresolvedLinks` — drawn as edges to *virtual* nodes (files that exist on disk but not inside the vault).

This is a pure in-memory operation — no files on disk are touched.

### Node Coloring

Node `color` is in `{ a: 1, rgb: 0xRRGGBB }` format (PixiJS color). On every patch pass the plugin sets each node's color based on its type:
- Skill root node (present in skillMap) → `colorSkill`
- Agent node (`type: agent` in frontmatter) → `colorAgent`
- Referenced file inside vault → `colorLocalRef`
- Referenced file outside vault → `colorExternalRef`

### Agent Nodes

A markdown file whose YAML frontmatter has `type: agent` is detected as an *agent* node and colored with `colorAgent`. This is intended for an "agent → visible skills" vault where each agent has one `.md` file containing markdown links to the skills it can see.

Agent → skill edges are produced by Obsidian's **native markdown-link resolution** — the plugin does not inject those edges (unlike SKILL.md reference edges). Detection uses `metadataCache` frontmatter only; if `type: agent` is later removed from a file, the plugin drops the now-stale node automatically.

### Performance

- **200 ms debounce**: `layout-change` fires frequently (resize, pane switch). Debouncing prevents redundant work.
- **`_skillGraphPatched` flag**: already-patched nodes are skipped on subsequent passes.
- **Incremental updates**: `metadataCache.on('changed')` re-parses only the changed SKILL.md.
- **500 ms periodic patch**: a `registerInterval` timer re-runs the patch pass every 500 ms while the plugin is loaded, to catch nodes the renderer adds dynamically (e.g. graph animation mode) without a `layout-change` event. The `_skillGraphPatched` flag keeps each pass cheap, and `registerInterval` clears the timer automatically on unload.

## Path Resolution

Reference path formats inside the OpenClaw ecosystem are inconsistent. The parser supports all of the following:

### Supported Path Formats

| Format | Example | Handling |
|--------|---------|----------|
| `{baseDir}/` prefix | `` `{baseDir}/scripts/run.sh` `` | Strip prefix → `scripts/run.sh` |
| Backtick relative path | `` `references/SCHEMA.md` `` | Extract directly |
| Markdown link | `[FORMS.md](references/forms.md)` | Extract link target |
| CLI command path | `python3 scripts/fetch.py` | Extract path after command |
| Absolute path | `/home/user/.../scripts/fetch.py` | Strip vault prefix and convert |

Supported CLI keywords: `python3`, `python`, `bash`, `node`, `sh`

### Dropped Path Formats

These never become graph nodes — they are discarded during parsing:

| Format | Where | Reason |
|--------|-------|--------|
| URLs (`https://...`) | `parse-references` | External links, not file references |
| Strings without a `/` and a file extension | `parse-references` | Not a file-path shape (e.g. prose, bare words) |
| Refs containing `[ ] { }` or `YYYY` | `skill-parser` | Templated/placeholder paths (e.g. `reports/[market]/YYYY-MM.md`) cannot resolve to a real file |

### Out-of-Vault Paths Become External Virtual Nodes

Path shapes that *look* like files but do not resolve to anything inside the vault are **not** dropped. They are injected into `metadataCache.unresolvedLinks` and shown as external virtual nodes (see [Edges](#edges)):

| Format | Example | Handling |
|--------|---------|----------|
| `~`-prefixed paths | `~/.openclaw/skills/foo/SKILL.md` | Shown as a virtual node; the plugin expands `~` and reads that file's frontmatter `name` for the label (see [Privacy & Data Access](#privacy--data-access)) |
| Dotfile paths (`.openclaw/skills/…`, `.claude/skills/…`) | `.openclaw/skills/foo/SKILL.md` | No special-casing — treated like any other unresolvable ref. Obsidian itself hides dotfile directories, so such a path never matches a vault file and becomes a virtual node |
| Any other relative path that no [fallback strategy](#three-level-fallback-resolution) resolves | `some/other/file.md` | Virtual node (no external name lookup unless `~`-prefixed) |

### Three-level Fallback Resolution

After the parser extracts a relative path, skill-parser tries three strategies to locate the file inside the vault:

```
Strategy 1: relative to the SKILL.md's parent directory
  scripts/run.sh → content-planner/scripts/run.sh
  Works for: {baseDir} references and files inside the skill directory

Strategy 2: from vault root
  content-analysis/SKILL.md → content-analysis/SKILL.md
  Works for: sibling skill directories

Strategy 3: strip the first path segment
  skills/content-analysis/SKILL.md → content-analysis/SKILL.md
  Works for: workspace-relative paths when vault root equals skills/
```

Absolute paths are resolved by matching the vault `basePath` prefix:
```
/home/user/workspace/skills/my-skill/scripts/fetch.py
→ strip vault prefix
→ my-skill/scripts/fetch.py
```

Paths that cannot be resolved by any strategy are silently ignored (the file may be outside the vault).

## Architecture

```
src/
├── main.ts              # Plugin entry point; event listeners, debounce, resolvedLinks injection
├── types.ts             # SkillInfo, PixiJS Text, GraphNode/Renderer/View types
├── settings.ts          # PluginSettingTab + defaults
├── skill-parser.ts      # Scans vault SKILL.md files; parses frontmatter + reference paths
├── parse-references.ts  # Pure function: extracts file paths from markdown text (unit-testable)
├── graph-patcher.ts     # Hooks graph renderer; renames nodes + applies colors
└── lang/                # i18n: helpers.ts (getLanguage()-based locale pick) + locale/{en,zh-tw}.ts
```

### Data Flow

```
vault file change
  → skill-parser re-parses SKILL.md
  → updates skillMap (Map<filePath, SkillInfo>)
  → main.ts injects resolvedLinks (so graph draws edges)
  → graph-patcher scans renderer.nodes
  → renames (text._text) + colors (node.color)
```

### Undocumented Obsidian APIs

This plugin relies on the following undocumented Obsidian internals (confirmed via inspection):

| API | Purpose | Risk |
|-----|---------|------|
| `leaf.view.renderer.nodes` | Access graph node array | May change with Obsidian updates |
| `node.text._text` | PixiJS Text display string | May change with PixiJS version bumps |
| `node.color = { a, rgb }` | Node color (PixiJS format) | Same as above |
| `metadataCache.resolvedLinks` | Inject in-vault edges | Relatively stable; used by multiple plugins |
| `metadataCache.unresolvedLinks` | Inject out-of-vault (virtual node) edges | Relatively stable; used by multiple plugins |
| `renderer.colors.fillUnresolved` | Recolor external/virtual nodes (overrides Obsidian's default gray) | May change with Obsidian updates; saved and restored on unload |
| `renderer.renderCallback` | Wrapped to re-apply colors every frame (prevents flicker) | May change with Obsidian updates; original saved and unhooked on unload |
| `vault.adapter.basePath` | Get vault absolute path | Desktop only; not available on mobile |

## Privacy & Data Access

This plugin accesses files **outside the vault** in one specific case: when a SKILL.md references an external file (e.g. `~/.openclaw/skills/foo/SKILL.md`), the plugin reads that file's YAML frontmatter to extract the `name` field for display in the graph. Only the `name` field is used; no file content is modified. No data is sent over the network.

## Known Limitations

- **Desktop only**: Uses Node.js `fs` and `vault.adapter.basePath`; not compatible with mobile.
- **External files are virtual nodes**: Out-of-vault files appear as nodes but cannot be opened (clicking creates a blank note). Use the symlink workaround or wait for v2 auto-symlink.
- **Edges are undirected**: Obsidian graph links have no arrows, so the direction of a "SKILL.md references scripts" relationship is not visible.

## Future Plans (v2)

- **Auto-symlink external references**: Automatically create symlinks in a `.external/` directory for out-of-vault files referenced by skills. This turns virtual nodes into real files that can be opened and browsed in Obsidian. Symlinks are cleaned up when the plugin is disabled. Desktop only (uses `ln -s` / `mklink /J`). Prior art: [obsidian-symlink-plugin](https://github.com/pteridin/obsidian_symlink_plugin).
- **Node tooltips**: Show SKILL.md `description` on hover.

## License

MIT

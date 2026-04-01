# Agent Skill Graph

An Obsidian plugin to visualize OpenClaw / Claude Code agent skill structures in graph view.

https://github.com/user-attachments/assets/5ae7f2b5-828a-46f6-97de-f2b910336050

In Graph View:
- SKILL.md nodes display the frontmatter `name` value (instead of the filename "SKILL")
- Files referenced inside SKILL.md are automatically parsed and connected with edges
- Nodes are colored by type (skill root node vs. referenced files)

Read-only — no original files are modified. All changes are in-memory and revert when the plugin is disabled.

## Installation

1. Symlink this directory into your vault's plugins folder:

```bash
mkdir -p <vault>/.obsidian/plugins
ln -s <path-to-this-repo> <vault>/.obsidian/plugins/obsidian-skill-graph
```

2. In Obsidian: Settings → Community plugins → enable **Agent Skill Graph**

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
| Name field | `name` | Frontmatter field used as the node label |
| Skill node color | `#DE7356` | Color for SKILL.md nodes |
| Reference node color | `#5B8CA4` | Color for referenced files inside the vault |
| External reference color | `#DBDBDB` | Color for referenced files outside the vault |

Enter hex color codes (e.g. `#ff6b6b`). Changes take effect after reopening Graph View.

## How It Works

### Node Renaming

Obsidian's Graph View renders with PixiJS (WebGL). The plugin listens to the `layout-change` event, scans `renderer.nodes`, and replaces the `text._text` property (a PixiJS Text object) of each SKILL.md node with the frontmatter `name` value. It also overrides `getDisplayText()` so other consumers receive the correct name.

### Edges

The plugin injects SKILL.md → referenced-file entries into `metadataCache.resolvedLinks`, which is the internal data structure Obsidian uses to track file links and that Graph View reads to create PixiJS link objects. This is a pure in-memory operation — no files on disk are touched.

### Node Coloring

Node `color` is in `{ a: 1, rgb: 0xRRGGBB }` format (PixiJS color). On every patch pass the plugin sets each node's color based on its type:
- Skill root node (present in skillMap) → `colorSkill`
- Referenced file inside vault → `colorLocalRef`
- Referenced file outside vault → `colorExternalRef`

### Performance

- **200 ms debounce**: `layout-change` fires frequently (resize, pane switch). Debouncing prevents redundant work.
- **`_skillGraphPatched` flag**: already-patched nodes are skipped on subsequent passes.
- **Incremental updates**: `metadataCache.on('changed')` re-parses only the changed SKILL.md.

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

### Ignored Path Formats

| Format | Reason |
|--------|--------|
| URLs (`https://...`) | External links, not file references |
| `~`-prefixed paths (`~/workspace/...`) | Home-directory paths; cannot reliably map to vault |
| `.openclaw/skills/` paths | Global skills; reserved for a future virtual-node feature |

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
└── graph-patcher.ts     # Hooks graph renderer; renames nodes + applies colors
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
| `metadataCache.resolvedLinks` | Inject virtual edges | Relatively stable; used by multiple plugins |
| `vault.adapter.basePath` | Get vault absolute path | Desktop only; not available on mobile |

## Known Limitations

- **Desktop only**: Uses Node.js `fs` and `vault.adapter.basePath`; not compatible with mobile.
- **External files are virtual nodes**: Out-of-vault files appear as nodes but cannot be opened (clicking creates a blank note). Use the symlink workaround or wait for v2 auto-symlink.
- **Edges are undirected**: Obsidian graph links have no arrows, so the direction of a "SKILL.md references scripts" relationship is not visible.

## Future Plans (v2)

- **Auto-symlink external references**: Automatically create symlinks in a `.external/` directory for out-of-vault files referenced by skills. This turns virtual nodes into real files that can be opened and browsed in Obsidian. Symlinks are cleaned up when the plugin is disabled. Desktop only (uses `ln -s` / `mklink /J`). Prior art: [obsidian-symlink-plugin](https://github.com/pteridin/obsidian_symlink_plugin).
- **Node tooltips**: Show SKILL.md `description` on hover.

## License

MIT

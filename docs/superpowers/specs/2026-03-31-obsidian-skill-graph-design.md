# Obsidian Skill Graph Plugin — Design Spec

## Overview

Obsidian 外掛，用來視覺化 OpenClaw / Claude Code 的 skill 結構。Hook 原生 Graph View，讓 SKILL.md 顯示 frontmatter `name` 作為節點名稱，自動解析內文引用的檔案並畫出連結箭頭，依節點類型上色。

**前提**：使用者以某個 agent 的 skills 目錄（如 `/Users/Hana/OpenClaw/mojo/skills`）作為 Obsidian vault。外掛純讀取，不修改任何原始檔案。

## Architecture

```
src/
├── main.ts              # Plugin 進入點，載入三個模組
├── skill-parser.ts      # 解析 SKILL.md frontmatter + 內文引用
├── graph-patcher.ts     # Hook graph view，改節點名稱 + 注入連結 + 虛擬節點
├── graph-styler.ts      # CSS 注入，三種節點類型不同顏色
├── settings.ts          # 設定頁面
└── types.ts             # 型別定義
```

三個模組各自負責一件事，透過 `SkillInfo` Map 溝通。

### Data Flow

```
vault 檔案變更 → skill-parser 重新解析 → 更新 Map<filePath, SkillInfo>
                                              ↓
graph view 開啟/刷新 → graph-patcher 讀取 Map → patch nodes + inject edges
                                              ↓
                                       graph-styler 套用顏色
```

## Module 1: Skill Parser (`skill-parser.ts`)

### 觸發時機

- Plugin 載入時全量掃描一次
- 監聽 `metadataCache.on('changed')` 做增量更新

### 解析邏輯

1. **找 SKILL.md**：用 `vault.getFiles()` 過濾所有符合 `skillFileName` 設定的檔案（預設 `SKILL.md`）
2. **解析 frontmatter**：從 `metadataCache.getFileCache(file)` 取 `nameField` 欄位（預設 `name`）
3. **抓引用檔案**：讀 SKILL.md 內文，用 regex 匹配以下模式：
   - 反引號路徑：`` `references/SCHEMA.md` ``、`` `scripts/run.sh` ``
   - Markdown 連結：`[FORMS.md](references/forms.md)`
   - `{baseDir}` 路徑：`{baseDir}/scripts/run.sh`
   - 相對路徑指令：`python3 scripts/fetch.py`、`bash scripts/run.sh`
4. **不抓的**：絕對路徑（`/Users/...`）、外部 URL（`https://...`）、frontmatter 內的 metadata
5. **路徑解析**：相對路徑以 SKILL.md 所在目錄為基準，用 `vault.getAbstractFileByPath()` 確認檔案存在，不存在的忽略
6. **全域引用偵測**：如果內文引用的路徑含 `.openclaw/skills/`（或符合 `globalSkillsPath` 設定），用 Node.js `fs` 讀取 vault 外的檔案 frontmatter

### 資料結構

```typescript
interface SkillInfo {
  filePath: string;        // "content-planner/SKILL.md"
  displayName: string;     // frontmatter name, e.g. "content-planner"
  references: string[];    // vault 內的引用路徑
  externalRefs: ExternalRef[];
}

interface ExternalRef {
  absolutePath: string;    // "/Users/Hana/OpenClaw/.openclaw/skills/check-traces/SKILL.md"
  displayName: string;     // 從外部檔案的 frontmatter 讀取
  virtualId: string;       // "global::check-traces"
}

// 全域 Map，key = filePath
type SkillMap = Map<string, SkillInfo>;
```

## Module 2: Graph Patcher (`graph-patcher.ts`)

### Hook 策略

1. 監聽 `app.workspace.on('layout-change')`
2. 用 `getLeavesOfType('graph')` + `getLeavesOfType('localgraph')` 取得 graph leaf
3. 存取 `leaf.view.renderer.nodes`（未公開 API，需自定義 type declaration）

### 節點改名

- 比對 `node.id` 是否對應某個 SkillInfo
- 直接覆寫 `getDisplayText()` → 回傳 `SkillInfo.displayName`

### 連結注入（vault 內）

- SkillInfo.references 裡的檔案存在於 vault → 找到對應 node，在 renderer edges 中加入連結

### 虛擬節點（vault 外的全域 skill）

1. 先嘗試注入 `metadataCache.unresolvedLinks`，讓 graph 自動產生灰色節點
2. 如果 unresolvedLinks 不可寫 → fallback 到手動在 renderer 建立虛擬 node 物件
3. 加入 edge 連接 SKILL.md → 虛擬節點

### 防重複 patch

- 在已 patch 的 node 加 `_skillGraphPatched = true` 標記
- layout-change 時只處理未 patch 的 node

## Module 3: Graph Styler (`graph-styler.ts`)

### 三種節點類型

| 類型 | 辨識方式 | 預設顏色 | 意義 |
|------|----------|----------|------|
| Skill 主節點 | 檔名為 SKILL.md | `#4a9eff`（亮藍） | 技能本體 |
| 本地引用 | 被 SkillInfo.references 包含 | `#a0c4e8`（淺灰藍） | scripts/、references/ 等 |
| 全域引用 | virtualId 以 `global::` 開頭 | `#c4a0e8`（淺紫） | .openclaw/skills/ 的外部技能 |

### 實作方式

1. graph-patcher patch node 時，在對應 DOM element 加上 `data-skill-type` attribute
2. 注入 CSS 使用 CSS variables，可被使用者 CSS snippet 覆寫
3. 初版 hardcode 預設色，不做 color picker UI

## Settings (`settings.ts`)

```typescript
interface SkillGraphSettings {
  skillFileName: string;     // 預設 "SKILL.md"
  nameField: string;         // 預設 "name"
  globalSkillsPath: string;  // vault 外的全域 skills 絕對路徑，空 = 不啟用
  colorSkill: string;        // 預設 "#4a9eff"
  colorLocalRef: string;     // 預設 "#a0c4e8"
  colorGlobalRef: string;    // 預設 "#c4a0e8"
}
```

設定存於 `.obsidian/plugins/obsidian-skill-graph/data.json`（Obsidian 自動管理）。

## Scope Boundaries

### 初版包含

- SKILL.md frontmatter name 取代 graph 節點名稱
- 解析內文引用並注入 graph 連結
- 全域 skill 虛擬節點（vault 外）
- 三種節點類型上色
- Settings 頁面（文字輸入）

### 初版不包含

- Color picker UI（用 hex 文字輸入）
- 自動建立 symlink
- 非 SKILL.md 格式的 skill 支援
- 節點 tooltip / hover 資訊
- Graph filter 擴充

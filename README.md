# Obsidian Skill Graph

Obsidian 外掛，用來視覺化 OpenClaw / Claude Code 的 skill 結構。

在 Graph View 中：
- SKILL.md 節點顯示 frontmatter `name`（而非檔名 "SKILL"）
- 自動解析 SKILL.md 內文引用的檔案，畫出連結線
- 依節點類型自動上色（skill 主節點 vs 引用檔案）

純讀取，不修改任何原始檔案。所有改動都在記憶體中，關閉外掛即恢復。

## 安裝

1. 將此目錄 symlink 到 vault 的 plugins 目錄：

```bash
mkdir -p <vault>/.obsidian/plugins
ln -s <path-to-this-repo> <vault>/.obsidian/plugins/obsidian-skill-graph
```

2. 在 Obsidian 中：Settings → Community plugins → 啟用 **Skill Graph**

### 開發模式

```bash
npm install
npm run dev    # watch mode，修改後自動重建
npm run build  # production build
npm test       # 執行單元測試
```

## 設定

Settings → Community plugins → Skill Graph（齒輪圖示）

| 設定 | 預設值 | 說明 |
|------|--------|------|
| Skill file name | `SKILL.md` | 要掃描的檔名 |
| Name field | `name` | frontmatter 裡哪個欄位當節點名稱 |
| Skill node color | `#4a9eff` | SKILL.md 節點顏色 |
| Reference node color | `#a0c4e8` | 被引用檔案的節點顏色 |

顏色輸入 hex 色碼（如 `#ff6b6b`），改完重新開啟 Graph View 即生效。

## 運作原理

### 節點改名

Obsidian 的 Graph View 用 PixiJS（WebGL）渲染。外掛在 `layout-change` 事件觸發時，掃描 `renderer.nodes`，將 SKILL.md 節點的 `text._text`（PixiJS Text 物件）改為 frontmatter `name` 值。同時覆寫 `getDisplayText()` 讓其他讀取者也得到正確值。

### 連結線

外掛在 `metadataCache.resolvedLinks` 注入 SKILL.md → 引用檔案的連結。這是 Obsidian 內部追蹤檔案連結的資料結構，Graph View 從這裡讀取來建立 PixiJS link 物件。純記憶體操作，不動磁碟上的檔案。

### 節點上色

節點的 `color` 屬性格式為 `{ a: 1, rgb: 0xRRGGBB }`（PixiJS 色彩格式）。外掛在每次 patch 時依節點類型設定顏色：
- Skill 主節點（在 skillMap 中）→ `colorSkill`
- 被引用檔案（在某個 skill 的 references 裡）→ `colorLocalRef`

### 效能

- 200ms debounce：`layout-change` 頻繁觸發（resize、切換 pane），debounce 避免重複計算
- `_skillGraphPatched` 標記：已 patch 的節點不會重複處理
- 增量更新：`metadataCache.on('changed')` 只重新解析變動的 SKILL.md

## 路徑解析

SKILL.md 引用檔案的寫法在 OpenClaw 生態中並不統一。外掛的 parser 支援以下所有格式：

### Parser 支援的路徑格式

| 格式 | 範例 | 處理方式 |
|------|------|----------|
| `{baseDir}/` 前綴 | `` `{baseDir}/scripts/run.sh` `` | 去掉前綴 → `scripts/run.sh` |
| 反引號相對路徑 | `` `references/SCHEMA.md` `` | 直接提取 |
| Markdown 連結 | `[FORMS.md](references/forms.md)` | 提取連結目標 |
| CLI 指令路徑 | `python3 scripts/fetch.py` | 提取指令後的檔案路徑 |
| 絕對路徑 | `/Users/harb/.../scripts/fetch.py` | 比對 vault 前綴後轉換 |

支援的 CLI 指令關鍵字：`python3`、`python`、`bash`、`node`、`sh`

### Parser 忽略的路徑

| 格式 | 原因 |
|------|------|
| URL（`https://...`） | 外部連結，非檔案引用 |
| `~` 開頭（`~/OpenClaw/...`） | Home 目錄路徑，無法可靠對應 vault |
| `.openclaw/skills/` 路徑 | 全域 skill，留給未來虛擬節點功能處理 |

### 路徑解析策略（三層 fallback）

Parser 提取出相對路徑後，skill-parser 用三種策略嘗試對應到 vault 內的實際檔案：

```
策略 1：相對於 SKILL.md 所在目錄
  scripts/run.sh → content-planner/scripts/run.sh
  適用：{baseDir} 引用、skill 目錄內的檔案

策略 2：從 vault 根目錄查找
  content-analysis/SKILL.md → content-analysis/SKILL.md
  適用：同層級的其他 skill 目錄

策略 3：去掉第一層目錄前綴
  skills/content-analysis/SKILL.md → content-analysis/SKILL.md
  適用：workspace 相對路徑（當 vault 根目錄就是 skills/ 時）
```

絕對路徑則比對 vault 的 `basePath` 前綴：
```
/Users/harb/OpenClaw/mojo/skills/threads-reply/scripts/fetch.py
→ 去掉 vault 前綴
→ threads-reply/scripts/fetch.py
```

三種策略都找不到的路徑會被忽略（檔案可能在 vault 外）。

## 架構

```
src/
├── main.ts              # Plugin 進入點，事件監聽，debounce，resolvedLinks 注入
├── types.ts             # SkillInfo、PixiJS Text、GraphNode/Renderer/View 型別
├── settings.ts          # PluginSettingTab + 預設值
├── skill-parser.ts      # 掃描 vault SKILL.md，解析 frontmatter + 引用路徑
├── parse-references.ts  # 純函式：從 markdown 文字提取檔案路徑（可單元測試）
└── graph-patcher.ts     # Hook graph renderer，改名 + 上色
```

### 資料流

```
vault 檔案變更
  → skill-parser 重新解析 SKILL.md
  → 更新 skillMap（Map<filePath, SkillInfo>）
  → main.ts 注入 resolvedLinks（讓 graph 畫連結線）
  → graph-patcher 掃描 renderer.nodes
  → 改名（text._text）+ 上色（node.color）
```

### Obsidian 未公開 API

本外掛依賴以下未公開的 Obsidian 內部結構（透過實測確認）：

| API | 用途 | 風險 |
|-----|------|------|
| `leaf.view.renderer.nodes` | 存取 graph 節點陣列 | Obsidian 更新可能改變結構 |
| `node.text._text` | PixiJS Text 物件的顯示文字 | PixiJS 版本升級可能影響 |
| `node.color = { a, rgb }` | 節點顏色（PixiJS 格式） | 同上 |
| `metadataCache.resolvedLinks` | 注入虛擬連結 | 較穩定，多個外掛使用此機制 |
| `vault.adapter.basePath` | 取得 vault 的絕對路徑 | Desktop only，行動版不適用 |

## 已知限制

- **僅支援桌面版**：使用 Node.js `fs` 和 `vault.adapter.basePath`，行動版無法使用
- **Vault 外的檔案不顯示**：workspace 共用資源（如 `references/branding/`、`social/profiles/`）如果不在 vault 目錄內，不會出現在 graph 上
- **連結線無方向**：Obsidian graph 的 link 沒有箭頭，無法區分「SKILL.md 引用 scripts」的方向
- **`~` 路徑不解析**：`~/OpenClaw/mojo/...` 格式的路徑目前被忽略

## 未來計畫（v2）

- **虛擬節點**：vault 外的全域 skill（`.openclaw/skills/`）和 workspace 共用檔案顯示為虛擬節點
- **`~` 路徑支援**：展開 `~` 為實際路徑後比對 vault
- **節點 tooltip**：hover 時顯示 SKILL.md 的 description

## License

MIT

# Rename to 渊火 (Abyssfire) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename the game from "掠生大陆 / Lootborn" to "渊火 / Abyssfire" across all code, config, docs, and GitHub infrastructure.

**Architecture:** Pure text replacement across ~10 files. No logic changes. GitHub repo rename is a manual step via GitHub Settings UI.

**Tech Stack:** TypeScript, Vite, GitHub Pages, Dexie.js (IndexedDB)

---

### Task 1: Rename player-facing strings in game code

**Files:**
- Modify: `index.html:6`
- Modify: `src/scenes/BootScene.ts:15`
- Modify: `src/scenes/UIScene.ts:595`

**Step 1: Edit index.html title**

Change line 6 from:
```html
<title>Lootborn - 掠生大陆</title>
```
to:
```html
<title>Abyssfire - 渊火</title>
```

**Step 2: Edit BootScene loading text**

In `src/scenes/BootScene.ts` line 15, change:
```typescript
const loadingText = this.add.text(width / 2, barY - 24, '锻造掠生大陆...', {
```
to:
```typescript
const loadingText = this.add.text(width / 2, barY - 24, '锻造渊火...', {
```

**Step 3: Edit UIScene map panel title**

In `src/scenes/UIScene.ts` line 595, change:
```typescript
this.mapPanel.add(this.add.text(pw / 2, 10, '掠生大陆', {
```
to:
```typescript
this.mapPanel.add(this.add.text(pw / 2, 10, '渊火', {
```

**Step 4: Commit**

```bash
git add index.html src/scenes/BootScene.ts src/scenes/UIScene.ts
git commit -m "feat: rename player-facing strings to 渊火 (Abyssfire)"
```

---

### Task 2: Rename SaveSystem database

**Files:**
- Modify: `src/systems/SaveSystem.ts:4,8,15`

**Step 1: Rename DB class and instance**

In `src/systems/SaveSystem.ts`:
- Line 4: `class LootbornDB extends Dexie {` → `class AbyssfireDB extends Dexie {`
- Line 8: `super('LootbornDB');` → `super('AbyssfireDB');`
- Line 15: `const db = new LootbornDB();` → `const db = new AbyssfireDB();`

**Step 2: Commit**

```bash
git add src/systems/SaveSystem.ts
git commit -m "feat: rename IndexedDB from LootbornDB to AbyssfireDB"
```

> **Note:** This breaks old saves. Acceptable for early development.

---

### Task 3: Update Vite config and package.json

**Files:**
- Modify: `vite.config.ts:4`
- Modify: `package.json:2`

**Step 1: Update vite base path**

In `vite.config.ts` line 4, change:
```typescript
base: '/lootborn/',
```
to:
```typescript
base: '/abyssfire/',
```

**Step 2: Update package name**

In `package.json` line 2, change:
```json
"name": "lootborn",
```
to:
```json
"name": "abyssfire",
```

**Step 3: Regenerate lock file**

```bash
npm install
```

This updates the name in `package-lock.json` automatically.

**Step 4: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "chore: update package name and vite base path to abyssfire"
```

---

### Task 4: Update documentation

**Files:**
- Modify: `CLAUDE.md:1`
- Modify: `docs/game-design.md:1,35`

**Step 1: Update CLAUDE.md header**

Line 1: `# Lootborn (掠生大陆)` → `# Abyssfire (渊火)`

**Step 2: Update game-design.md**

- Line 1: `# Lootborn Game Design Document` → `# Abyssfire Game Design Document`
- Line 35: `## World — Lootborn (掠生大陆)` → `## World — Abyssfire (渊火)`

**Step 3: Commit**

```bash
git add CLAUDE.md docs/game-design.md
git commit -m "docs: update project name to Abyssfire (渊火)"
```

---

### Task 5: Update auto-memory

**Files:**
- Modify: `/Users/feuvan/.claude/projects/-Users-feuvan-src-pixelmud/memory/MEMORY.md`

**Step 1: Update memory references**

Change all occurrences:
- "Lootborn / 掠生大陆" → "Abyssfire / 渊火"
- Repo URL: `github.com/feuvan/lootborn` → `github.com/feuvan/abyssfire`
- Live URL: `feuvan.github.io/lootborn/` → `feuvan.github.io/abyssfire/`
- Custom domain: `blog.feuvan.net/lootborn` → `blog.feuvan.net/abyssfire`
- Vite base path: `/lootborn/` → `/abyssfire/`

**Step 2: No commit needed** (memory files are outside the repo)

---

### Task 6: Rename GitHub repository (manual)

This step requires the user to do it via GitHub UI.

**Step 1: Rename repo on GitHub**

Go to: GitHub repo → Settings → General → Repository name
Change: `lootborn` → `abyssfire`

**Step 2: Update local git remote**

```bash
git remote set-url origin git@github.com:feuvan/abyssfire.git
```

**Step 3: Verify**

```bash
git remote -v
```

Expected output should show `feuvan/abyssfire.git`.

**Step 4: Push all changes and verify deploy**

```bash
git push origin main
```

Check that GitHub Pages deploys correctly at the new URL.

---

### Task 7: Verify build

**Step 1: Run local build**

```bash
npm run build
```

Expected: Clean build with no errors.

**Step 2: Run dev server**

```bash
npm run dev
```

Expected: Game loads at localhost:5173, title shows "渊火", loading screen shows "锻造渊火...", map panel shows "渊火".

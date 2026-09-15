# MLBB Draft Coach — System Context

## What it does

Draft assistant for Mobile Legends. User picks allies + enemies + bans. App scores every hero 0-100, suggests picks/bans, warns about synergy and missing roles.

**No server, no login, no AI.** Pure math on local JSON files.

## Current Data (patch 2.1.95a)

| File | Rows | Source |
| --- | --- | --- |
| `data/heroes.json` | 133 | mlbbhub API + scraped pages |
| `data/counters.json` | 1497 | 50 hand-written + 1447 scraped |
| `data/synergies.json` | 30 | hand-written |
| `data/meta.json` | 133 | mlbbhub API |
| `data/patches.json` | 3 | mlbbhub (should be official) |

- **21 heroes** fully scored (skill scores + tags)
- **112 heroes** have `NoData` tag (scores all 5, no tags — counters still work, comp doesn't)

## Score Formula

`finalScore = counter*0.5 + meta*0.3 + comp*0.15 + mastery*0.05`

| Part | Weight | What it measures |
| --- | --- | --- |
| Counter | 50% | How many enemies this hero counters (coverage + effectiveness) |
| Meta | 30% | Tier, win rate, patch changes |
| Comp | 15% | What ally team needs (frontline, damage, anti-mobility, role overlap, synergy) |
| Mastery | 5% | User skill (always 50 for now, UI doesn't send it) |

## Rank Comparator (`rankCmp` in `src/draft/draft.ts`)

Used by both list sort and suggest picks. Floats badge-heavy heroes to top:

1. **Total badges** (counters + allies) — most badges first
2. **Counter count** — more countered enemies wins
3. **Synergy count** — more allied synergies wins
4. **Counter effectiveness** — `breakdown.counter`
5. **Total score** — `score`

Unscored heroes sink to bottom; meta breaks their tie.

## Suggest Picks (`suggestPickIds`)

- One top hero per empty lane (max 3 lanes)
- Excludes lanes already taken by allies
- Uses `rankCmp` to pick best per lane
- **Empty draft** (no allies, no enemies) → `fallbackPicks` (top 3 by tier + pick rate)
- **Allies only** (no enemies) → `suggestLanePicks` (per-lane synergy count, then meta)
- Returns `{id, counters, allies, lane}`

## Suggest Bans (`suggestBanIds`)

- Targets threats to **allies** (heroes that counter our picks)
- Rank: covered allies count → threat score → ban priority
- **No allies** → `fallbackBans` (top 3 by `banPriority` = tier*10*0.5 + ban_rate*0.5)
- Returns `{id, counters}`

## List Sort (`rankList`)

- Name match always passes; score only orders
- Lane/role/tier filters are strict
- Enemies present → `rankCmp` on `scoreMap`
- No enemies → `metaKey` (tier*10 + pick rate)
- Allies-only draft → synergy-only `scoreMap` built in `App.tsx` so badges show and sort works

## UI Tags

- `⚔ Enemy` gold chips — counter tags, inline next to hero name (collapsed row)
- `✦ Ally` green chips — synergy tags, same row
- Lane chip, tier chip, score badge also visible without expanding

## Data Pipeline

```bashbash
pnpm data:update <patch>      # sync heroes + meta from mlbbhub API, scrape new heroes, cache icons
pnpm counters:update <patch>  # scrape /counter/<slug> for every hero, add proven + strong-against rows
pnpm icons:cache [slug...]    # download icons to public/icons/
```

**`data:update`:**

1. Fetches `mlbbhub.com/api/stats` → refreshes `meta.json`
2. New heroes → scrapes hero page for name/role/lane/icon, appends with `NoData` tag
3. Caches new icons locally

**`counters:update`:**

1. For each hero, scrapes `/counter/<slug>`
2. "Proven Counters" with +pp → `COUNTER` rows (score = `min(10, round(5 + pp))`)
3. "Strong Against" → `COUNTERED_BY` rows (victim-first, score 6)
4. Skips conflicts with hand-written rows (preserves M1 seed data)
5. Validates all rows before writing

## Guards

- Slug regex `/^[a-z0-9][a-z0-9-]{0-39}$/` — blocks path traversal/shell metacharacters
- Icon host whitelist (`wsrv.nl` only)
- Webp magic byte check before writing icons
- Counter/meta row validation (score ranges, required fields, no self-counter)
- Path escape check on icon filenames
- No shell execution (no `execSync`/`child_process`)

## File Map

```
src/engine/
  score.ts     — counterScore, synergyScore, metaScore, compScore, finalScore, teamRating
  recommend.ts — recommend() assembles Rec with breakdown + counters + allies
  types.ts     — Hero, CounterRel, SynergyRel, MetaRow, Rec, Weights
  weights.json — {counter:0.5, meta:0.3, comp:0.15, mastery:0.05}

src/draft/
  draft.ts     — rankList, suggestPickIds, suggestBanIds, fallbackPicks, fallbackBans, rankCmp, allyWarnings, teamWeakness

src/ui/
  rows.tsx     — HeroRows (collapsed + expanded), SuggestPair (pick/ban columns)
  slots.tsx    — DraftBoard (pick/ban slots for both teams)
  filter.tsx   — FilterBar (lane/role/tier/q)
  avatar.tsx   — Hero avatar with tier ring
  theme.ts     — constants (ALL_LANE, ALL_ROLE, MAX_LINE, TIER_INFO, TIER_RING)
  errors.tsx   — error boundary state

src/
  App.tsx      — main component, builds scoreMap (enemy or synergy-only), wires everything
  i18n.ts      — Indonesian + English strings
  index.css    — all styles

scripts/
  data-update.mjs    — sync heroes + meta from mlbbhub
  counters-update.mjs — scrape counter pages
  cache-icons.mjs    — download icons to public/icons/
  parse.mjs          — pure parsing/validation (unit-tested)
  http.mjs           — shared fetch with User-Agent from package.json

tests/
  engine.test.ts   — recommend, teamRating, weights
  draft.test.ts    — rankList, suggestPickIds, suggestBanIds, banPriority, fallbackBans
  scripts.test.ts  — parse.mjs pure functions, data guards, script hardening
```

## Key Decisions

- **`COUNTERED_BY` victim-first**: scraped rows pointed backwards; flipped to match hand-written rows
- **Coverage count ranks first**: more countered enemies beats lone high score
- **Total badges float to top**: heroes with both counter + synergy badges rank highest
- **Ban targets team picks**: ban threats to allies; empty allies fall back to global OP bans
- **Per-lane pick suggestion**: one hero per empty lane, not just top 3 overall
- **Synergy-only scoreMap for allies-only drafts**: list still shows badges and sorts by synergy when no enemies picked

## What's Not Done

- 112 heroes have no skill scores or tags (comp can't evaluate them)
- Comp rules are fixed (don't change per patch)
- Mastery weight exists but UI always sends 50
- No official Moonton data (counters + win rates from mlbbhub)
- `patches.json` should use official patch notes, still points to mlbbhub
- Draft not saved (reload loses it)

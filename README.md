# MLBB Draft Coach

Helper for Mobile Legends draft pick. Put in both teams' heroes and bans. Tells which heroes to pick
or ban, score 0 to 100 plus the reason why.

Score always same for same draft. Plain math on JSON files. No server, no login, no AI.

<p align="center">
  <img src="docs/screenshot.png" width="380" alt="MLBB Draft Coach showing Fanny on the enemy side and Khufra ranked first in the recommendations">
</p>

In the picture, Fanny on enemy team. Khufra top pick, score 93.7.

## What it can do

- **Draft board** — pick and ban slots for both teams, 5 each. Hero only on one slot.
- **Top 5 picks** — score + reasons. Tap card for score breakdown.
- **Ban suggestions** — top 3 bans.
- **Warnings** — bad synergy between your heroes, missing lane, no tank, no damage.
- **Tier and win rate** — shown for every hero.
- **Two languages** — Indonesian and English.
- **Works offline** — hero icons saved on your computer.

## How to run it

Need Node 24 and pnpm.

```bash
pnpm install
pnpm dev       # start the app
pnpm test      # run the tests
pnpm build     # build for release
pnpm lint      # Biome lint
pnpm format    # Biome format
```

Linting and formatting use [Biome](https://biomejs.dev) (`biome.json`). `pnpm lint` reports 0 errors
and 0 warnings.

## Where the data comes from

All data in `data/` folder as JSON. Two row types.

### 1. Written by hand

50 counter rows, 30 synergy rows. Each has reason + source link.

```json
{
  "source": "khufra",
  "target": "fanny",
  "type": "COUNTER",
  "score": 10,
  "tags": ["anti-dash"],
  "reason": "Skill 2 Bouncing Ball cancel dash kabel Fanny.",
  "sources": ["https://mlbbhub.com/counter/fanny"]
}
```

`tags` say *why* counter works, like `anti-dash` or `suppression`.

### 2. Taken from mlbbhub

1448 counter rows. Script downloads them. `COUNTERED_BY` rows are victim-first
(source loses, target wins) to match hand-written rows.

```json
{
  "source": "zhask",
  "target": "kaja",
  "type": "COUNTERED_BY",
  "score": 6,
  "tags": ["measured"],
  "reason": "Zhask lemah lawan kaja (mlbbhub strong-against). Hindari pick zhask.",
  "sources": ["https://mlbbhub.com/counter/kaja"]
}
```

Hand-written row beats downloaded row on conflict.

### Links

Most data from these sites:

| Site | What we take from it |
| --- | --- |
| [mlbbhub.com/counter/…](https://mlbbhub.com/counter/fanny) | counter matchups |
| [mlbbhub.com/api/stats](https://mlbbhub.com/api/stats) | win rate, pick rate, ban rate, tier |
| [mlbbhub.com/heroes/…](https://mlbbhub.com/heroes/fanny) | hero name, role, lane, icon |
| [mlbbhub.com/statistics](https://mlbbhub.com/statistics) | synergy reasons, patch changes |
| [mlbb.tools](https://mlbb.tools/guides/how-to-counter-fanny) | extra check for 1 row |

No official Moonton data for counters or win rates. So project uses mlbbhub.

`patches.json` should use official patch notes from
[mobilelegends.com](https://www.mobilelegends.com/news/), but all 3 rows still point to mlbbhub.
Needs fixing.

Every row has source link. None missing. Script checks row before save. Bad scores, heroes countering
themselves, missing links thrown away.

## The data files

| File | Rows | What is inside |
| --- | --- | --- |
| `data/heroes.json` | 133 | name, role, lane, scores, tags, icon |
| `data/counters.json` | 1498 | who counters who |
| `data/synergies.json` | 30 | who works well with who |
| `data/meta.json` | 133 | win rate, pick rate, ban rate, tier |
| `data/patches.json` | 3 | buff and nerf list |

Current patch **2.1.95a**.

### About the `NoData` tag

112 heroes have this tag. Means nobody wrote their skill scores yet, so those scores all 5 and no
tags. Does **not** mean no counter data — all 112 have counters and win rates. Only comp part of
score lost. See next section.

## How the score works

Score has four parts. Each part 0 to 100.

| Part | Weight | What it looks at |
| --- | --- | --- |
| Counter | 50% | how many enemy heroes this hero counters |
| Meta | 30% | tier, win rate, and patch changes |
| Comp | 15% | what your team still needs |
| Mastery | 5% | how good you are with the hero (always 50 for now) |

`Comp` looks at what your team needs. Adds or removes points like this:

| If | Points |
| --- | --- |
| Your team has no tank, and this hero is a tank | +25 |
| Your team has no damage, and this hero does damage | +25 |
| The enemy has mobility, and this hero stops it | +15 |
| This hero's role is already covered by your team | −20 |
| This hero is bad with one of your heroes | − that score |
| This hero is good with one of your heroes | + that score |

Ban suggestions use same `recommend()` function, two teams swapped. Then add ban rate, take top 3.

## Files in this project

```
mlbb-draft/
  biome.json             Biome lint + format config
  data/                  the JSON files
  src/engine/            the score math
  src/App.tsx            the whole UI
  src/i18n.ts            Indonesian and English text
  scripts/               tools to download and check data
  tests/                 17 tests
  public/icons/          133 hero icons
```

## Updating the data

```bash
pnpm data:update 2.1.96      # find new heroes, refresh win rates
pnpm counters:update 2.1.96  # refresh counter matchups
pnpm icons:cache <slug>      # download hero icons
```

Just tools run now and then. App itself never downloads anything.

### What `data:update` does

1. Fetches `mlbbhub.com/api/stats` → refreshes `meta.json` (win_rate, pick_rate, ban_rate, tier)
2. New heroes → scrapes hero page for name/role/lane/icon, appends to `heroes.json` with `NoData` tag
3. Caches new icons locally via `cache-icons.mjs`

### What `counters:update` does

1. For each hero, scrapes `/counter/<slug>`
2. "Proven Counters" with +pp → `COUNTER` rows (score = `min(10, round(5 + pp))`)
3. "Strong Against" → `COUNTERED_BY` rows (victim-first, score 6)
4. Skips conflicts with hand-written rows (preserves M1 seed data)
5. Validates all rows before writing

## What is not done yet

- **112 heroes have no skill scores or tags.** Comp part cannot give them points.
- **Comp rules are fixed.** Do not change per patch.
- **Mastery is not used.** Weight there, but UI always sends 50.
- **No official data.** Counters and win rates from mlbbhub. Only `patches.json` should use official
  notes, and it does not yet.
- **A draft is not saved.** Reload page, lose it.

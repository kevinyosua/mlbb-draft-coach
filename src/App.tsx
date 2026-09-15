import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { loadAll, type GameData } from './data/load';
import { allyWarnings as allyWarns, metaById as makeMetaById, rankList, suggestBanIds, suggestPickIds, teamWeakness } from './draft/draft';
import { recommend } from './engine/recommend';
import { synergyScore, teamRating } from './engine/score';
import type { Rec } from './engine/types';
import { STR, type Lang } from './i18n';
import { reportError, useLastError } from './ui/errors';
import { FilterBar } from './ui/filter';
import { HeroRows, SuggestPair } from './ui/rows';
import { DraftBoard } from './ui/slots';
import { ALL_LANE, ALL_ROLE, MAX_LINE, type Side } from './ui/theme';

let data: GameData;
try {
  data = loadAll();
} catch {
  reportError('load');
  data = { heroes: [], counters: [], syn: [], meta: [], patches: [], weights: { counter: 0.5, meta: 0.3, comp: 0.15, mastery: 0.05 } };
}

export default function App() {
  const [lang, setLang] = useState<Lang>('id');
  const [allies, setAllies] = useState<string[]>([]);
  const [enemies, setEnemies] = useState<string[]>([]);
  const [ourBans, setOurBans] = useState<string[]>([]);
  const [enemyBans, setEnemyBans] = useState<string[]>([]);
  const bans = useMemo(() => [...ourBans, ...enemyBans], [ourBans, enemyBans]);

  const [q, setQ] = useState('');
  const [lane, setLane] = useState(ALL_LANE);
  const [role, setRole] = useState(ALL_ROLE);
  const [tier, setTier] = useState<string | null>(null);
  const [openHero, setOpenHero] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(true);
  const qRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (filterOpen) qRef.current?.focus();
  }, [filterOpen]);
  const t = STR[lang];
  const lastErr = useLastError();

  const lanes = [ALL_LANE, ...new Set(data.heroes.map((h) => h.lane))];
  const roles = [ALL_ROLE, ...new Set(data.heroes.flatMap((h) => h.roles))];
  const metaById = useMemo(() => makeMetaById(data.meta), []);
  // Skor tiap hero lawan musuh. Satu sumber urutan list + kotak suggest.
  // Allies-only draft (no enemy yet) -> synergy-only rec map so list still
  // ranks by synergy count and shows ✦ badges.
  const scoreMap = useMemo(() => {
    try {
      if (data.heroes.length === 0) return new Map<string, Rec>();
      if (enemies.length > 0) {
        const recs = recommend({
          allies,
          enemies,
          bans,
          pool: data.heroes,
          counters: data.counters,
          syn: data.syn,
          meta: data.meta,
          patches: data.patches,
          weights: data.weights,
          limit: data.heroes.length,
        });
        return new Map(recs.map((r) => [r.hero, r]));
      }
      if (allies.length > 0) {
        const pickedSet = new Set([...allies, ...bans]);
        const map = new Map<string, Rec>();
        for (const h of data.heroes) {
          if (pickedSet.has(h.id)) continue;
          const { allies: mates, score } = synergyScore(h.id, allies, data.syn);
          map.set(h.id, {
            hero: h.id,
            score,
            reasons: [],
            breakdown: { counter: 0, meta: 0, comp: 0, mastery: 0 },
            counters: [],
            allies: mates,
          });
        }
        return map;
      }
      return new Map<string, Rec>();
    } catch {
      reportError('rec');
      return new Map<string, Rec>();
    }
  }, [allies, enemies, bans]);
  // Nama cocok selalu tampil, skor hanya untuk urutan. Lane/role/tier strict.
  const picked = useMemo(() => new Set([...allies, ...enemies, ...bans]), [allies, enemies, bans]);
  const list = useMemo(
    () =>
      rankList({
        heroes: data.heroes,
        byId: metaById,
        picked,
        q,
        lane,
        allLane: ALL_LANE,
        role,
        allRole: ALL_ROLE,
        tier,
        enemies,
        scoreMap,
      }),
    [picked, enemies, q, lane, role, tier, scoreMap, metaById],
  );
  const dirty = q !== '' || lane !== ALL_LANE || role !== ALL_ROLE || tier !== null;
  // Exclusive pick: a hero lives on exactly one line (ally/enemy/ourBan/enemyBan).
  const clearOthers = (id: string, keep: Side) => {
    if (keep !== 'ally') setAllies((v) => v.filter((x) => x !== id));
    if (keep !== 'enemy') setEnemies((v) => v.filter((x) => x !== id));
    if (keep !== 'ourBan') setOurBans((v) => v.filter((x) => x !== id));
    if (keep !== 'enemyBan') setEnemyBans((v) => v.filter((x) => x !== id));
  };
  const addSide = (side: Side, id: string) => {
    if (side === 'ally') {
      if (allies.length >= MAX_LINE && !allies.includes(id)) return;
      clearOthers(id, 'ally');
      if (!allies.includes(id)) setAllies([...allies, id]);
    } else if (side === 'enemy') {
      if (enemies.length >= MAX_LINE && !enemies.includes(id)) return;
      clearOthers(id, 'enemy');
      if (!enemies.includes(id)) setEnemies([...enemies, id]);
    } else if (side === 'ourBan') {
      if (ourBans.length >= MAX_LINE && !ourBans.includes(id)) return;
      clearOthers(id, 'ourBan');
      if (!ourBans.includes(id)) setOurBans([...ourBans, id]);
    } else {
      if (enemyBans.length >= MAX_LINE && !enemyBans.includes(id)) return;
      clearOthers(id, 'enemyBan');
      if (!enemyBans.includes(id)) setEnemyBans([...enemyBans, id]);
    }
    setQ('');
  };
  const removeSide = (side: Side, id: string) => {
    if (side === 'ally') setAllies(allies.filter((x) => x !== id));
    else if (side === 'enemy') setEnemies(enemies.filter((x) => x !== id));
    else if (side === 'ourBan') setOurBans(ourBans.filter((x) => x !== id));
    else setEnemyBans(enemyBans.filter((x) => x !== id));
  };
  const allyWarnings = useMemo(() => allyWarns(data.heroes, data.syn, allies, t.antiSyn), [allies, t.antiSyn]);
  const weakness = useMemo(
    () => teamWeakness(data.heroes, allies, { missing: t.missing, noFrontline: t.noFrontline, noDamage: t.noDamage }),
    [allies, t.missing, t.noFrontline, t.noDamage],
  );
  const banSug = useMemo(
    () =>
      suggestBanIds({
        allies,
        enemies,
        bans,
        heroes: data.heroes,
        counters: data.counters,
        syn: data.syn,
        meta: data.meta,
        patches: data.patches,
        weights: data.weights,
      }),
    [allies, enemies, bans],
  );
  const pickSug = useMemo(
    () => suggestPickIds(allies, enemies, scoreMap, data.heroes, data.meta, [...allies, ...enemies, ...bans], data.syn),
    [enemies, scoreMap, allies, bans],
  );
  // Rating draft ally vs enemy (0-100). Lihat teamRating di engine/score.
  const allyRating = useMemo(
    () => teamRating(allies, enemies, data.heroes, data.counters, data.syn, data.meta, data.patches, data.weights),
    [allies, enemies],
  );
  const enemyRating = useMemo(
    () => teamRating(enemies, allies, data.heroes, data.counters, data.syn, data.meta, data.patches, data.weights),
    [allies, enemies],
  );
  // ponytail: dynamic widths stay as vars (rule flags object literals) — CSS attr() when widely supported.
  const allyBar = { width: `${Math.round(allyRating)}%` } as CSSProperties;
  const enemyBar = { width: `${Math.round(enemyRating)}%` } as CSSProperties;

  return (
    <div className="mdc-app">
      <header className="mdc-topbar">
        <h1 className="mdc-goldnum mdc-brand">
          {t.title}
          <span className="mdc-sr"> — {t.tagline}</span>
        </h1>
        <div className="mdc-row-c">
          <span className="mdc-muted">
            {t.patch} {data.heroes[0]?.patch}
          </span>
          <button
            type="button"
            onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
            aria-label={lang === 'id' ? 'Ganti ke English' : 'Switch to Indonesian'}
            title={lang === 'id' ? 'Ganti ke English' : 'Switch to Indonesian'}
          >
            {lang.toUpperCase()}
          </button>
        </div>
      </header>

      {lastErr ? (
        <section className="mdc-card mdc-err mdc-mt8" role="alert">
          <span className="mdc-muted">{lastErr === 'load' ? t.loadError : t.recError}</span>
        </section>
      ) : null}

      <DraftBoard
        allies={allies}
        enemies={enemies}
        ourBans={ourBans}
        enemyBans={enemyBans}
        max={MAX_LINE}
        titles={{ allies: t.allies, enemies: t.enemies, ourBans: t.ourBans, enemyBans: t.enemyBans }}
        removeWord={t.remove}
        heroes={data.heroes}
        meta={data.meta}
        lang={lang}
        onRemove={removeSide}
      />
      {(allies.length > 0 || enemies.length > 0) && (
        <section className="mdc-card mdc-mt8" aria-label={t.draftRating}>
          <p className="mdc-title">{t.draftRating}</p>
          <div className="mdc-col6">
            <div className="mdc-rate-row">
              <span className="mdc-rate-ally">{t.allies}</span>
              <div
                className="mdc-score mdc-grow"
                role="progressbar"
                aria-valuenow={Math.round(allyRating)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${t.allies} rating`}
              >
                <i style={allyBar} />
              </div>
              <b className="mdc-goldnum mdc-rate-num">{allyRating}</b>
            </div>
            <div className="mdc-rate-row">
              <span className="mdc-rate-enemy">{t.enemies}</span>
              <div
                className="mdc-score mdc-grow"
                role="progressbar"
                aria-valuenow={Math.round(enemyRating)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${t.enemies} rating`}
              >
                <i style={enemyBar} />
              </div>
              <b className="mdc-goldnum mdc-rate-num">{enemyRating}</b>
            </div>
          </div>
        </section>
      )}
      <SuggestPair
        pickSug={pickSug}
        banSug={banSug}
        heroes={data.heroes}
        meta={data.meta}
        lang={lang}
        titles={{ picks: t.suggestPicks, bans: t.suggestBans }}
        onPick={(id) => addSide('ally', id)}
        onBan={(id) => addSide('ourBan', id)}
      />
      {(allyWarnings.length > 0 || (allies.length > 0 && weakness.length > 0)) && (
        <section className="mdc-card mdc-warn" role="status">
          {allyWarnings.length > 0 && (
            <>
              <b>{t.warnings}</b>
              <ul className="mdc-ul-loose">
                {allyWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
          {allies.length > 0 && (
            <>
              <b>{t.weakness}</b>
              <ul className="mdc-ul-tight">
                {weakness.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <div className="mdc-results-row">
        <p className="mdc-muted mdc-results">
          {t.results} · {list.length} hero · {enemies.length === 0 ? t.sortedByMeta : t.sortedByCounter}
          {list.length === 0 ? ` — ${t.noResults}` : ''}
        </p>
        {list.length === 0 && dirty && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setLane(ALL_LANE);
              setRole(ALL_ROLE);
              setTier(null);
            }}
          >
            {t.resetFilter}
          </button>
        )}
      </div>

      <HeroRows
        list={list}
        allies={allies}
        enemies={enemies}
        ourBans={ourBans}
        enemyBans={enemyBans}
        max={MAX_LINE}
        scoreMap={scoreMap}
        metaById={metaById}
        openHero={openHero}
        showScore={enemies.length > 0}
        heroes={data.heroes}
        meta={data.meta}
        lang={lang}
        labels={{ pickGroup: t.pickGroup, banGroup: t.banGroup, teamUs: t.teamUs, teamThem: t.teamThem }}
        onToggle={(id) => setOpenHero(openHero === id ? null : id)}
        onAdd={(s, id) => {
          addSide(s, id);
          setOpenHero(null);
        }}
      />

      <FilterBar
        open={filterOpen}
        q={q}
        lane={lane}
        role={role}
        tier={tier}
        lanes={lanes}
        roles={roles}
        dirty={dirty}
        lang={lang}
        labels={t}
        qRef={qRef}
        onQ={setQ}
        onLane={setLane}
        onRole={setRole}
        onTier={(tr) => setTier(tier === tr ? null : tr)}
        onReset={() => {
          setQ('');
          setLane(ALL_LANE);
          setRole(ALL_ROLE);
          setTier(null);
        }}
        onOpen={() => setFilterOpen(true)}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  );
}

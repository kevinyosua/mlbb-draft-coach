import { useEffect, useRef, type CSSProperties } from 'react';
import { Avatar } from './avatar';
import type { SuggestItem } from '../draft/draft';
import type { Hero, MetaRow, Rec } from '../engine/types';
import type { Lang } from '../i18n';
import { TIER_INFO, TIER_RING, type Side } from './theme';

interface SuggestPairProps {
  pickSug: SuggestItem[];
  banSug: SuggestItem[];
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  titles: { picks: string; bans: string };
  onPick: (id: string) => void;
  onBan: (id: string) => void;
}

function SuggestCol({
  items,
  heroes,
  meta,
  lang,
  rate,
  onPick,
}: {
  items: SuggestItem[];
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  rate: 'pick_rate' | 'ban_rate';
  onPick: (id: string) => void;
}) {
  const word = rate === 'pick_rate' ? 'pick' : 'ban';
  const nameOf = (id: string) => heroes.find((x) => x.id === id)?.name ?? id;
  return (
    <div className="mdc-col8">
      {items.map(({ id, counters, allies, lane }) => {
        const h = heroes.find((x) => x.id === id);
        if (!h) return null;
        const m = meta.find((x) => x.hero === id);
        return (
          <button
            type="button"
            key={id}
            className="mdc-press mdc-suggest"
            onClick={() => onPick(id)}
            title={m ? `Tier ${m.tier}: ${TIER_INFO[lang][m.tier]}` : ''}
          >
            <Avatar id={id} heroes={heroes} meta={meta} lang={lang} size={28} />
            <span className="mdc-sub">
              {h.name} {lane ? <span className="mdc-chip">{lane}</span> : null}
              <br />
              <span className="mdc-muted">
                {m ? (
                  <>
                    <span className={`mdc-chip mdc-tier${m.tier}`}>{m.tier}</span> {m[rate]}% {word}
                  </>
                ) : (
                  ''
                )}
              </span>
              {(counters?.length ?? 0) > 0 && (
                <>
                  <br />
                  <span className="mdc-counters">
                    {(counters ?? []).map((c) => (
                      <span key={c} className="mdc-chip mdc-counter" title={`Counters ${nameOf(c)}`}>
                        ⚔ {nameOf(c)}
                      </span>
                    ))}
                  </span>
                </>
              )}
              {(allies?.length ?? 0) > 0 && (
                <>
                  <br />
                  <span className="mdc-counters">
                    {(allies ?? []).map((a) => (
                      <span key={a} className="mdc-chip mdc-synergy" title={`Synergy with ${nameOf(a)}`}>
                        ✦ {nameOf(a)}
                      </span>
                    ))}
                  </span>
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SuggestPair(p: SuggestPairProps) {
  return (
    <section className="mdc-card mdc-mt8">
      <div className="mdc-grid2">
        <div>
          <p className="mdc-title">{p.titles.picks}</p>
          <SuggestCol items={p.pickSug} heroes={p.heroes} meta={p.meta} lang={p.lang} rate="pick_rate" onPick={p.onPick} />
        </div>
        <div>
          <p className="mdc-title mdc-title-red">{p.titles.bans}</p>
          <SuggestCol items={p.banSug} heroes={p.heroes} meta={p.meta} lang={p.lang} rate="ban_rate" onPick={p.onBan} />
        </div>
      </div>
      <div className="mdc-legend mdc-mt8">
        {(['S', 'A', 'B', 'C', 'D'] as const).map((tr) => {
          // ponytail: dot color dynamic from data — keep CSS var, map to class when palette fixed.
          const dot = { '--dot': TIER_RING[tr] } as CSSProperties;
          return (
            <span key={tr} title={TIER_INFO[p.lang][tr]}>
              <i className="mdc-dot" style={dot} />
              {tr} {TIER_INFO[p.lang][tr]}
            </span>
          );
        })}
      </div>
    </section>
  );
}

interface HeroRowsProps {
  list: Hero[];
  allies: string[];
  enemies: string[];
  ourBans: string[];
  enemyBans: string[];
  max: number;
  scoreMap: Map<string, Rec>;
  metaById: Map<string, MetaRow>;
  openHero: string | null;
  showScore: boolean;
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  labels: { pickGroup: string; banGroup: string; teamUs: string; teamThem: string };
  onToggle: (id: string) => void;
  onAdd: (side: Side, id: string) => void;
}

interface HeroRowProps {
  h: Hero;
  i: number;
  where: Side | null;
  full: (s: Side) => boolean;
  expanded: boolean;
  rec: Rec | undefined;
  mt: string | undefined;
  m: MetaRow | undefined;
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  showScore: boolean;
  labels: HeroRowsProps['labels'];
  onToggle: () => void;
  onAdd: (s: Side, id: string) => void;
}

function HeroRow(p: HeroRowProps) {
  const actionsRef = useRef<HTMLDivElement>(null);
  const wasExpanded = useRef(p.expanded);
  // Unfold list: keep action buttons clear of the sticky filter bar.
  useEffect(() => {
    if (p.expanded && !wasExpanded.current) actionsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    wasExpanded.current = p.expanded;
  }, [p.expanded]);
  const { h, i, where, rec, mt, m } = p;
  const act = (s: Side, label: string, fullLabel: string) => {
    const banned = s === 'ourBan' || s === 'enemyBan';
    return (
      <button
        type="button"
        key={s}
        onClick={() => p.onAdd(s, h.id)}
        disabled={where === s || (!where && p.full(s))}
        aria-label={fullLabel}
        className={`mdc-act${banned ? ' mdc-ban-act' : ''}`}
      >
        {banned ? <span aria-hidden="true">✕&nbsp;</span> : null}
        {label}
        {where === s ? ' ✓' : ''}
      </button>
    );
  };
  // ponytail: bar width dynamic per score — keep CSS var, switch to attr() when supported.
  const bar = { '--bar': `${Math.round(rec?.score ?? 0)}%` } as CSSProperties;
  return (
    <div className="mdc-card mdc-rowcard">
      <button type="button" className="mdc-press mdc-rowbtn" onClick={p.onToggle} aria-expanded={p.expanded}>
        <Avatar id={h.id} heroes={p.heroes} meta={p.meta} lang={p.lang} size={30} />
        <div className="mdc-uname">
          <b>
            #{i + 1} {h.name}
          </b>{' '}
          {mt ? (
            <span className={`mdc-chip mdc-tier${mt}`} title={`Tier ${mt}: ${TIER_INFO[p.lang][mt]}`}>
              {mt}
            </span>
          ) : null}{' '}
          <span className="mdc-chip">{h.lane}</span> <span className="mdc-muted">{h.roles.join('/')}</span>
          <br />
          <span className="mdc-muted">{m ? `${m.win_rate}% WR · ${m.pick_rate}% pick` : 'no meta'}</span>
        </div>
        {p.showScore && rec ? <b className="mdc-goldnum mdc-bignum">{rec.score}</b> : null}
        {rec && (rec.counters.length > 0 || (rec.allies?.length ?? 0) > 0) && (
          <span className="mdc-inline-tags">
            {rec.counters.map((c) => (
              <span key={c} className="mdc-chip mdc-counter" title={`Counters ${c}`}>
                ⚔ {c}
              </span>
            ))}
            {(rec.allies ?? []).map((a) => (
              <span key={a} className="mdc-chip mdc-synergy" title={`Synergy with ${a}`}>
                ✦ {a}
              </span>
            ))}
          </span>
        )}
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" className="mdc-chev">
          <path
            d={p.expanded ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4'}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {p.showScore && rec ? (
        <div
          className="mdc-score mdc-mt6"
          role="progressbar"
          aria-valuenow={Math.round(rec.score)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${h.name} score`}
        >
          <i className="mdc-bar" style={bar} />
        </div>
      ) : null}
      {p.expanded && (
        <>
          {rec && rec.reasons.length > 0 && (
            <ul className="mdc-reasons">
              {[...new Set(rec.reasons)].map((x: string) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          {rec && (
            <>
              <div className="mdc-muted mdc-mt4">
                counter {Math.round(rec.breakdown.counter)} · meta {Math.round(rec.breakdown.meta)} · comp {Math.round(rec.breakdown.comp)}{' '}
                · mastery {Math.round(rec.breakdown.mastery)}
              </div>
              {(rec.counters.length > 0 || (rec.allies?.length ?? 0) > 0) && (
                <div className="mdc-tags">
                  {rec.counters.map((c) => (
                    <span key={c} className="mdc-chip mdc-counter" title={`Counters ${c}`}>
                      ⚔ {c}
                    </span>
                  ))}
                  {(rec.allies ?? []).map((a) => (
                    <span key={a} className="mdc-chip mdc-synergy" title={`Synergy with ${a}`}>
                      ✦ {a}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="mdc-actions" ref={actionsRef}>
            <div className="mdc-actgroup">
              <span className="mdc-acthead">{p.labels.pickGroup}</span>
              <div className="mdc-actpair">
                {act('ally', p.labels.teamUs, `Pick ${p.labels.teamUs}`)}
                {act('enemy', p.labels.teamThem, `Pick ${p.labels.teamThem}`)}
              </div>
            </div>
            <div className="mdc-actgroup mdc-actgroup-ban">
              <span className="mdc-acthead mdc-acthead-ban">{p.labels.banGroup}</span>
              <div className="mdc-actpair">
                {act('ourBan', p.labels.teamUs, `Ban ${p.labels.teamUs}`)}
                {act('enemyBan', p.labels.teamThem, `Ban ${p.labels.teamThem}`)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function HeroRows(p: HeroRowsProps) {
  return (
    <section className="mdc-col8" aria-label="hero list">
      {p.list.map((h, i) => {
        const where: Side | null = p.allies.includes(h.id)
          ? 'ally'
          : p.enemies.includes(h.id)
            ? 'enemy'
            : p.ourBans.includes(h.id)
              ? 'ourBan'
              : p.enemyBans.includes(h.id)
                ? 'enemyBan'
                : null;
        const full = (s: Side) =>
          s === 'ally'
            ? p.allies.length >= p.max
            : s === 'enemy'
              ? p.enemies.length >= p.max
              : s === 'ourBan'
                ? p.ourBans.length >= p.max
                : p.enemyBans.length >= p.max;
        return (
          <HeroRow
            key={h.id}
            h={h}
            i={i}
            where={where}
            full={full}
            expanded={p.openHero === h.id}
            rec={p.scoreMap.get(h.id)}
            mt={p.metaById.get(h.id)?.tier}
            m={p.metaById.get(h.id)}
            heroes={p.heroes}
            meta={p.meta}
            lang={p.lang}
            showScore={p.showScore}
            labels={p.labels}
            onToggle={() => p.onToggle(h.id)}
            onAdd={p.onAdd}
          />
        );
      })}
    </section>
  );
}

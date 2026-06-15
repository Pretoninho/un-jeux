<script lang="ts">
  import { hexRevenue, actorIncome, type Ownership, type RevenueConfig } from './engine/revenue';
  import { axialToPixel, hexPointsPointy, genBounds } from './lib/layout';
  import type { GameMap, Hex } from './engine/types';

  // ── Petite carte de test : grappe de 7 hexes (un centre + 6 voisins) ──────────
  // Coordonnées axiales (pointe en haut) ; adjacence dérivée de la géométrie hex.
  const AXIAL: Array<{ id: string; q: number; r: number }> = [
    { id: 'A', q: 0, r: 0 },   // centre
    { id: 'B', q: 1, r: 0 },
    { id: 'C', q: 0, r: 1 },
    { id: 'D', q: -1, r: 1 },
    { id: 'E', q: -1, r: 0 },
    { id: 'F', q: 0, r: -1 },
    { id: 'G', q: 1, r: -1 },
  ];

  // Voisins axiaux (pointe en haut) : 6 directions.
  const DIRS: Array<[number, number]> = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  function neighborsOf(q: number, r: number): string[] {
    const ids: string[] = [];
    for (const [dq, dr] of DIRS) {
      const found = AXIAL.find((a) => a.q === q + dq && a.r === r + dr);
      if (found) ids.push(found.id);
    }
    return ids;
  }

  const MAP: GameMap = {
    id: 'revdemo',
    hexes: AXIAL.map<Hex>((a) => ({
      id: a.id,
      label: a.id,
      kind: 'marche',
      neighbors: neighborsOf(a.q, a.r),
      coord: { q: a.q, r: a.r },
    })),
  };

  // Revenu de base par hex (le centre A vaut plus, pour montrer la différenciation).
  const cfg: RevenueConfig = {
    baseByHex: { A: 10, B: 6, C: 6, D: 6, E: 6, F: 6, G: 6 },
    agglomerationBonus: 4,
  };

  // ── Propriété : clic cycle libre → alice → bob → libre ────────────────────────
  const OWNERS = [null, 'alice', 'bob'] as const;
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };

  function emptyOwnership(): Ownership {
    const o: Ownership = {};
    for (const h of MAP.hexes) o[h.id] = null;
    return o;
  }
  let ownership = $state<Ownership>(emptyOwnership());

  function cycle(id: string) {
    const cur = ownership[id] ?? null;
    const idx = OWNERS.indexOf(cur as (typeof OWNERS)[number]);
    const next: string | null = OWNERS[(idx + 1) % OWNERS.length] ?? null;
    ownership = { ...ownership, [id]: next };
  }

  function reset() {
    ownership = emptyOwnership();
  }

  // ── Layout pixel ──────────────────────────────────────────────────────────────
  const centers: Record<string, [number, number]> = {};
  for (const a of AXIAL) centers[a.id] = axialToPixel(a.q, a.r);
  const b = genBounds(Object.values(centers));
  const viewBox = `${b.minX.toFixed(1)} ${b.minY.toFixed(1)} ${b.w.toFixed(1)} ${b.h.toFixed(1)}`;

  // ── Vues réactives ──────────────────────────────────────────────────────────
  const rev = (id: string) => hexRevenue(id, ownership, MAP, cfg);
  const base = (id: string) => cfg.baseByHex[id] ?? 0;
  const bonus = (id: string) => rev(id) - (ownership[id] ? base(id) : 0);
  const income = (who: string) => actorIncome(who, ownership, MAP, cfg);
</script>

<div class="demo">
  <div class="demo-header">
    <h2>Revenu &amp; agglomération · demo <span class="hint">clic = changer de propriétaire</span></h2>
    <button onclick={reset} class="reset">Réinitialiser</button>
  </div>

  <div class="layout">
    <svg {viewBox} class="map">
      {#each MAP.hexes as h (h.id)}
        {@const c = centers[h.id]!}
        {@const owner = ownership[h.id]}
        <g class="hex" role="button" tabindex="0"
           onclick={() => cycle(h.id)}
           onkeydown={(e) => e.key === 'Enter' && cycle(h.id)}>
          <polygon
            points={hexPointsPointy(c[0], c[1])}
            fill={owner ? COLORS[owner] : '#1c2029'}
            stroke={owner ? '#0e1015' : '#2a2f3a'}
            stroke-width="2" />
          <text x={c[0]} y={c[1] - 8} class="hid">{h.id}</text>
          {#if owner}
            <text x={c[0]} y={c[1] + 4} class="rev">{rev(h.id)}</text>
            {#if bonus(h.id) > 0}
              <text x={c[0]} y={c[1] + 16} class="bonus">+{bonus(h.id)}</text>
            {/if}
          {:else}
            <text x={c[0]} y={c[1] + 6} class="base muted">{base(h.id)}</text>
          {/if}
        </g>
      {/each}
    </svg>

    <div class="panel">
      <div class="legend">
        <div class="leg"><span class="dot" style="background:{COLORS.alice}"></span> alice</div>
        <div class="leg"><span class="dot" style="background:{COLORS.bob}"></span> bob</div>
        <div class="muted small">Clic sur un hex : libre → alice → bob → libre.</div>
      </div>

      <div class="incomes">
        <div class="inc-row alice">
          <span>Revenu alice</span>
          <b>{income('alice')}<span class="per">/tour</span></b>
        </div>
        <div class="inc-row bob">
          <span>Revenu bob</span>
          <b>{income('bob')}<span class="per">/tour</span></b>
        </div>
      </div>

      <div class="rules muted small">
        <b>SI→ALORS :</b>
        <div>• Possédé → <b>base</b> (chiffre sur l'hex)</div>
        <div>• Voisin du <em>même</em> proprio → <b>+{cfg.agglomerationBonus}</b> chacun (la prime verte)</div>
        <div>• Libre → personne n'encaisse</div>
        <div class="tip">💡 Pose une grappe contiguë vs des hexes dispersés → compare les totaux.</div>
      </div>
    </div>
  </div>
</div>

<style>
  .demo { background: #0e1015; border: 1px solid #2a2f3a; border-radius: 10px; padding: 1.2rem; margin-top: 1rem; }
  .demo-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .demo-header h2 { margin: 0; font-size: 1rem; }
  .hint { color: #7a8294; font-size: .8rem; font-weight: 400; }
  .muted { color: #7a8294; }
  .small { font-size: .8rem; }

  .layout { display: grid; grid-template-columns: 1fr 240px; gap: 1rem; align-items: start; }
  .map { width: 100%; background: #14161c; border-radius: 8px; }
  .hex { cursor: pointer; }
  .hex:hover polygon { stroke: #fff; stroke-width: 3; }
  .hid { fill: #cdd3df; font-size: 11px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .rev { fill: #fff; font-size: 13px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .bonus { fill: #b9f5cf; font-size: 9px; text-anchor: middle; pointer-events: none; }
  .base { fill: #5a6172; font-size: 11px; text-anchor: middle; pointer-events: none; }

  .panel { display: flex; flex-direction: column; gap: 1rem; }
  .legend { background: #14161c; border-radius: 6px; padding: .6rem .8rem; }
  .leg { display: flex; align-items: center; gap: .5rem; font-size: .85rem; padding: .1rem 0; }
  .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }

  .incomes { display: flex; flex-direction: column; gap: .5rem; }
  .inc-row { display: flex; justify-content: space-between; align-items: baseline; background: #14161c; border-radius: 6px; padding: .5rem .8rem; border-left: 3px solid; }
  .inc-row.alice { border-color: #5ab0a0; }
  .inc-row.bob { border-color: #e07a3a; }
  .inc-row span { font-size: .82rem; color: #9aa3b5; }
  .inc-row b { font-size: 1.3rem; }
  .inc-row.alice b { color: #5ab0a0; }
  .inc-row.bob b { color: #e07a3a; }
  .per { font-size: .7rem; color: #7a8294; font-weight: 400; }

  .rules { background: #14161c; border-radius: 6px; padding: .6rem .8rem; line-height: 1.6; }
  .tip { margin-top: .4rem; color: #9aa3b5; }
  .reset { background: none; border: 1px solid #2a2f3a; color: #7a8294; padding: .3rem .7rem; border-radius: 4px; cursor: pointer; font-size: .8rem; }
  .reset:hover { border-color: #888; color: #cdd3df; }
</style>

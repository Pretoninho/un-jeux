<script lang="ts">
  import {
    makeCamp,
    campCharge,
    actorCharges,
    repayDebt,
    canRepay,
    type Camp,
    type Tronc,
  } from './engine/camp';

  // ── État ──────────────────────────────────────────────────────────────────
  interface Actor {
    id: string;
    label: string;
    tronc: Tronc;
    cash: number;
    camps: Camp[];
    log: string[];
  }

  const CHARGE_RATE = 0.1; // 10 % du capital par tour
  const DEFAULT_LOAN = 100;

  let actors = $state<Actor[]>([
    { id: 'alice', label: 'Alice', tronc: 'A', cash: 50,  camps: [], log: [] },
    { id: 'bob',   label: 'Bob',   tronc: 'B', cash: 50,  camps: [], log: [] },
  ]);

  let loanAmounts = $state<Record<string, number>>({ alice: DEFAULT_LOAN, bob: DEFAULT_LOAN });
  let repayAmounts = $state<Record<string, number>>({ alice: 0, bob: 0 });
  let turn = $state(0);

  // ── Actions ───────────────────────────────────────────────────────────────
  function takeLoan(actorId: string) {
    const amount = loanAmounts[actorId] ?? DEFAULT_LOAN;
    if (amount <= 0) return;
    actors = actors.map((a) => {
      if (a.id !== actorId) return a;
      const camp = makeCamp(a.id, amount, a.tronc, CHARGE_RATE);
      return {
        ...a,
        cash: a.cash + amount,
        camps: [...a.camps, camp],
        log: [`T${turn} emprunt ${amount} → capital +${amount}`, ...a.log],
      };
    });
  }

  function repay(actorId: string, campId: string) {
    const amount = repayAmounts[actorId] ?? 0;
    if (amount <= 0) return;
    actors = actors.map((a) => {
      if (a.id !== actorId) return a;
      let paid = 0;
      let msg = '';
      const newCamps = a.camps.map((c) => {
        if (c.id !== campId) return c;
        const result = repayDebt(c, Math.min(amount, a.cash));
        paid = result.repaid;
        msg = result.extinguished
          ? `T${turn} remboursement ${paid} → camp éteint ✓`
          : `T${turn} remboursement ${paid} → reliquat ${result.camp.debtRemaining}`;
        return result.camp;
      }).filter((c) => c.debtRemaining > 0 || c.tronc === 'A');
      return {
        ...a,
        cash: a.cash - paid,
        camps: newCamps,
        log: msg ? [msg, ...a.log] : a.log,
      };
    });
  }

  function tick() {
    turn += 1;
    actors = actors.map((a) => {
      const charge = actorCharges(a.id, a.camps);
      const paid = Math.min(charge, a.cash);
      const deficit = charge - paid;
      const msg = deficit > 0
        ? `T${turn} charges ${charge.toFixed(1)} — déficit ${deficit.toFixed(1)} ⚠`
        : `T${turn} charges −${charge.toFixed(1)}`;
      return { ...a, cash: a.cash - paid, log: [msg, ...a.log] };
    });
  }

  function reset() {
    turn = 0;
    actors = actors.map((a) => ({ ...a, cash: 50, camps: [], log: [] }));
    loanAmounts = { alice: DEFAULT_LOAN, bob: DEFAULT_LOAN };
    repayAmounts = { alice: 0, bob: 0 };
  }

  // ── Dérivés ───────────────────────────────────────────────────────────────
  const TRONC_COLORS: Record<Tronc, string> = { A: '#e07a3a', B: '#5ab0a0' };
  const TRONC_LABELS: Record<Tronc, string> = {
    A: 'Tronc A — conquérant (dette permanente)',
    B: 'Tronc B — rentier (dette remboursable)',
  };
</script>

<div class="demo">
  <div class="demo-header">
    <h2>Camp / emprunt · demo
      <span class="hint">Tronc A = dette fixe · Tronc B = remboursable</span>
    </h2>
    <div class="header-actions">
      <button class="tick-btn" onclick={tick}>⏩ Tour +1</button>
      <button class="reset" onclick={reset}>Réinitialiser</button>
    </div>
  </div>

  <div class="turn-badge">Tour {turn}</div>

  <div class="actors">
    {#each actors as actor (actor.id)}
      {@const charge = actorCharges(actor.id, actor.camps)}
      {@const net = (income: number) => income - charge}
      {@const color = TRONC_COLORS[actor.tronc]}
      <div class="actor-card" style="--color:{color}">
        <div class="actor-head">
          <span class="actor-name">{actor.label}</span>
          <span class="tronc-tag" style="color:{color}">{actor.tronc}</span>
          <span class="cash">💰 {actor.cash.toFixed(1)}</span>
        </div>
        <div class="tronc-desc muted small">{TRONC_LABELS[actor.tronc]}</div>

        <!-- Emprunt -->
        <div class="action-row">
          <input
            type="number"
            min="1"
            bind:value={loanAmounts[actor.id]}
            class="num-input"
            aria-label="montant emprunt"
          />
          <button class="act-btn" onclick={() => takeLoan(actor.id)}>
            Emprunter (10 %/tour)
          </button>
        </div>

        <!-- Camps ouverts -->
        {#if actor.camps.length > 0}
          <div class="camps">
            {#each actor.camps as camp (camp.id)}
              {@const ch = campCharge(camp)}
              <div class="camp-row">
                <div class="camp-info">
                  <span class="camp-id muted">{camp.id}</span>
                  <span>prêt {camp.loanAmount}</span>
                  {#if camp.tronc === 'B'}
                    <span>reliquat <b>{camp.debtRemaining}</b></span>
                  {/if}
                  <span class="charge-tag">−{ch.toFixed(1)}/tour</span>
                </div>
                {#if canRepay(camp)}
                  <div class="repay-row">
                    <input
                      type="number"
                      min="1"
                      bind:value={repayAmounts[actor.id]}
                      class="num-input small-input"
                      aria-label="montant remboursement"
                    />
                    <button class="act-btn small-btn"
                      onclick={() => repay(actor.id, camp.id)}>
                      Rembourser
                    </button>
                  </div>
                {:else if camp.tronc === 'A'}
                  <span class="perm-tag muted small">permanent</span>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="muted small no-camp">Aucun camp ouvert.</div>
        {/if}

        <!-- Résumé financier -->
        <div class="summary">
          <div class="sum-row">
            <span class="muted small">Charges/tour</span>
            <b class="red">{charge > 0 ? `−${charge.toFixed(1)}` : '0'}</b>
          </div>
          <div class="sum-row">
            <span class="muted small">Cash</span>
            <b class:danger={actor.cash < charge}>{actor.cash.toFixed(1)}</b>
          </div>
        </div>

        <!-- Journal -->
        {#if actor.log.length > 0}
          <div class="log">
            {#each actor.log.slice(0, 5) as entry}
              <div class="log-entry small muted">{entry}</div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="rules muted small">
    <b>SI→ALORS :</b>
    <div>• Emprunter → capital +montant, charge +10 % du prêt/tour</div>
    <div>• Tronc A : charge fixe à vie (intérêts permanents, jamais remboursé)</div>
    <div>• Tronc B : charge ∝ reliquat — rembourser réduit la charge ; à 0 = camp éteint</div>
    <div>• ⏩ Tour +1 → déduit toutes les charges du cash</div>
  </div>
</div>

<style>
  .demo { background: #0e1015; border: 1px solid #2a2f3a; border-radius: 10px; padding: 1.2rem; margin-top: 1rem; }
  .demo-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .8rem; }
  .demo-header h2 { margin: 0; font-size: 1rem; }
  .hint { color: #7a8294; font-size: .8rem; font-weight: 400; }
  .header-actions { display: flex; gap: .5rem; }

  .turn-badge { display: inline-block; background: #1a1e28; border: 1px solid #2a2f3a; border-radius: 4px; padding: .2rem .6rem; font-size: .8rem; color: #9aa3b5; margin-bottom: 1rem; }

  .actors { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .actor-card { background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: 1rem; border-top: 3px solid var(--color); }

  .actor-head { display: flex; align-items: baseline; gap: .6rem; margin-bottom: .2rem; }
  .actor-name { font-weight: 700; font-size: 1rem; }
  .tronc-tag { font-size: .75rem; font-weight: 700; }
  .cash { margin-left: auto; font-size: .9rem; }
  .tronc-desc { margin-bottom: .8rem; }

  .action-row { display: flex; gap: .4rem; margin-bottom: .6rem; }
  .num-input { background: #1a1e28; border: 1px solid #2a2f3a; color: #cdd3df; border-radius: 4px; padding: .3rem .5rem; width: 70px; font-size: .85rem; }
  .small-input { width: 60px; }
  .act-btn { background: #1a1e28; border: 1px solid #3a4050; color: #cdd3df; border-radius: 4px; padding: .3rem .6rem; cursor: pointer; font-size: .82rem; white-space: nowrap; }
  .act-btn:hover { border-color: #5a8090; }
  .small-btn { font-size: .75rem; padding: .2rem .4rem; }

  .camps { display: flex; flex-direction: column; gap: .5rem; margin-bottom: .6rem; }
  .camp-row { background: #1a1e28; border-radius: 6px; padding: .5rem .7rem; }
  .camp-info { display: flex; gap: .6rem; align-items: baseline; flex-wrap: wrap; font-size: .82rem; margin-bottom: .3rem; }
  .camp-id { font-size: .72rem; }
  .charge-tag { background: #2a1a1a; color: #e07a3a; border-radius: 3px; padding: .1rem .3rem; font-size: .75rem; }
  .repay-row { display: flex; gap: .4rem; align-items: center; }
  .perm-tag { margin-top: .2rem; display: block; }

  .no-camp { margin-bottom: .6rem; }

  .summary { display: flex; flex-direction: column; gap: .3rem; border-top: 1px solid #2a2f3a; padding-top: .6rem; margin-top: .6rem; }
  .sum-row { display: flex; justify-content: space-between; align-items: baseline; }
  .sum-row b { font-size: 1rem; }
  .red { color: #e07a3a; }
  .danger { color: #e05050; }

  .log { border-top: 1px solid #2a2f3a; margin-top: .6rem; padding-top: .4rem; }
  .log-entry { padding: .1rem 0; border-bottom: 1px solid #1a1e28; }

  .rules { background: #14161c; border-radius: 6px; padding: .6rem .8rem; margin-top: 1rem; line-height: 1.7; }
  .muted { color: #7a8294; }
  .small { font-size: .8rem; }

  .tick-btn { background: #1a2030; border: 1px solid #3a4060; color: #9ab0d0; border-radius: 4px; padding: .3rem .7rem; cursor: pointer; font-size: .82rem; }
  .tick-btn:hover { border-color: #5a70b0; }
  .reset { background: none; border: 1px solid #2a2f3a; color: #7a8294; padding: .3rem .7rem; border-radius: 4px; cursor: pointer; font-size: .8rem; }
  .reset:hover { border-color: #888; color: #cdd3df; }
</style>

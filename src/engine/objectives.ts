// OBJECTIFS / SUCCÈS — détection PURE (sans DOM), extraite de la vue de combat.
//
// Une checklist d'onboarding débloquée par OBSERVATION de l'état : on compare l'état AVANT/APRÈS
// chaque coup et on déduit les objectifs atteints. Module pur (immuable, testable sans navigateur) ;
// la vue ne garde que l'effet de bord (localStorage + toast).
//
// ⚠️ FRONTIÈRE joueur vs diff : `m_move`/`m_attack` (et `h_bastion3`, attribution fine via un
// compteur) NE sont PAS détectés ici — ils sont déclenchés dans les handlers du JOUEUR pour ne pas
// créditer un coup ADVERSE. `detectUnlocks` ne couvre que ce qui se déduit sûrement d'un diff d'état.

import { winner, type CombatState } from './combat';

export interface Objective {
  id: string;
  cat: 'Mécanique' | 'Duos & héros';
  label: string;
}

export const OBJECTIVES: Objective[] = [
  { id: 'm_move', cat: 'Mécanique', label: 'Déplacer une pièce' },
  { id: 'm_attack', cat: 'Mécanique', label: 'Attaquer un ennemi' },
  { id: 'm_guard', cat: 'Mécanique', label: 'Mettre une Lourde en Garde' },
  { id: 'm_reserve', cat: 'Mécanique', label: 'Réserver un tir (Tireur)' },
  { id: 'm_riposte', cat: 'Mécanique', label: 'Armer une Riposte (Duelliste)' },
  { id: 'm_status', cat: 'Mécanique', label: 'Infliger un statut (marque/estropié/silence/étourdi)' },
  { id: 'm_resonance', cat: 'Mécanique', label: 'Déclencher une Résonance' },
  { id: 'm_nemesis', cat: 'Mécanique', label: 'Tuer un Némésis' },
  { id: 'm_win', cat: 'Mécanique', label: 'Gagner une partie' },
  { id: 'h_estoc_bastion', cat: 'Duos & héros', label: 'Résonance Estoc × Bastion (épines)' },
  { id: 'h_mireille', cat: 'Duos & héros', label: 'Déclencher une Résonance de Mireille' },
  { id: 'h_bastion3', cat: 'Duos & héros', label: 'Frapper 3 fois avec Bastion' },
  { id: 'h_fil_nemesis', cat: 'Duos & héros', label: 'Tuer son Némésis avec Fil' },
];

export const OBJ_CATS = ['Mécanique', 'Duos & héros'] as const;

/**
 * Objectifs NOUVELLEMENT débloqués entre `prev` et `cur`, hors ceux déjà dans `alreadyUnlocked`.
 * PUR (aucun effet de bord). Couvre la part « diff d'état » :
 *  - postures armées (garde / tir réservé / riposte) ;
 *  - statut subi (marque / estropié / silence / étourdi) ;
 *  - Résonance partie (un cooldown qui saute de 0 → >0) + duos signature (Estoc×Bastion, Mireille) ;
 *  - kill de Némésis (mort dont `lastHitBy` = même archétype, camp adverse) + Fil ;
 *  - victoire.
 * `m_move`/`m_attack`/`h_bastion3` sont volontairement ABSENTS (déclenchés côté joueur).
 */
export function detectUnlocks(prev: CombatState, cur: CombatState, alreadyUnlocked: Set<string>): string[] {
  const out: string[] = [];
  const add = (id: string) => { if (!alreadyUnlocked.has(id) && !out.includes(id)) out.push(id); };

  const pById = new Map(prev.units.map((u) => [u.id, u] as const));
  for (const u of cur.units) {
    const p = pById.get(u.id);
    if (u.guarding && !p?.guarding) add('m_guard');
    if (u.watching && !p?.watching) add('m_reserve');
    if (u.riposting && !p?.riposting) add('m_riposte');
    if ((u.mark && !p?.mark) || (u.cripple && !p?.cripple) || (u.silence && !p?.silence) || (u.stun && !p?.stun)) add('m_status');
    if (p && u.cooldowns) for (const [rid, cd] of Object.entries(u.cooldowns)) {
      if (cd > 0 && !((p.cooldowns?.[rid] ?? 0) > 0)) {     // un cooldown qui SAUTE de 0 → la Résonance vient de partir
        add('m_resonance');
        if (rid === 'epines_estoc_bastion') add('h_estoc_bastion');
        if (u.characterId === 'mireille') add('h_mireille');
      }
    }
  }

  // Morts → kills de Némésis (le tueur = lastHitBy, même archétype, camp adverse).
  for (const dead of prev.units) {
    if (cur.units.some((u) => u.id === dead.id)) continue;
    const killer = dead.lastHitBy ? prev.units.find((u) => u.id === dead.lastHitBy) : undefined;
    if (killer && killer.kind === dead.kind && killer.owner !== dead.owner) {
      add('m_nemesis');
      if (killer.characterId === 'fil') add('h_fil_nemesis');
    }
  }

  if (winner(cur) !== null) add('m_win');
  return out;
}

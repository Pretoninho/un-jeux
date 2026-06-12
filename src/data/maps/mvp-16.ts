// Carte MVP — transcription de la spec mvp-spec §4. Donnée interchangeable :
// tester une autre carte = fournir un autre fichier (spec §11bis).
//
// NOTE de cohérence à régler au calibrage : la prose de la spec §4 annonce
// « 11 hexes marché · 3 nœuds · 2 frontière » (=16), mais la liste d'adjacence
// — partie faisant foi — définit 13 hexes (8 marché + 2 frontière + 3 nœuds).
// On transcrit fidèlement la liste d'adjacence (le concret) ; l'écart de comptage
// est laissé en suspens plutôt qu'« inventé ». À trancher avant J5 (UI).

import type { GameMap } from '../../engine/types';

// β/γ/carry sont des points de départ illustratifs (charges structurelles, memo
// §25.1) : crédit = β bas / carry haut, actions = β haut / carry bas, alternatifs
// entre les deux. À calibrer en J7.
export const MVP_MAP: GameMap = {
  id: 'mvp-16',
  hexes: [
    // ── Crédit Investment Grade ──
    { id: 'IG_EU', label: 'IG EU', kind: 'marche', cluster: 'credit', beta: 0.5, gamma: 0.8, carry: 0.03, neighbors: ['IG_US', 'LC_EU'] },
    { id: 'IG_US', label: 'IG US', kind: 'marche', cluster: 'credit', beta: 0.5, gamma: 0.8, carry: 0.03, neighbors: ['IG_EU', 'IG_EM', 'LC_US', 'HY_US', 'FED', 'INFO'] },
    { id: 'IG_EM', label: 'IG EM', kind: 'marche', cluster: 'credit', beta: 0.7, gamma: 0.8, carry: 0.05, neighbors: ['IG_US', 'LC_EM'] },

    // ── Actions Large Cap ──
    { id: 'LC_EU', label: 'LC EU', kind: 'marche', cluster: 'actions', beta: 1.0, gamma: 0.9, carry: 0.015, neighbors: ['LC_US', 'IG_EU', 'IMMO'] },
    { id: 'LC_US', label: 'LC US', kind: 'marche', cluster: 'actions', beta: 1.0, gamma: 0.9, carry: 0.015, neighbors: ['LC_EU', 'LC_EM', 'IG_US', 'PEVC'] },
    { id: 'LC_EM', label: 'LC EM', kind: 'marche', cluster: 'actions', beta: 1.3, gamma: 0.9, carry: 0.02, neighbors: ['LC_US', 'IG_EM'] },

    // ── Alternatifs ──
    { id: 'IMMO', label: 'Immobilier', kind: 'marche', cluster: 'alternatifs', beta: 0.8, gamma: 0.6, carry: 0.04, neighbors: ['LC_EU', 'PEVC'] },
    { id: 'PEVC', label: 'PE / VC', kind: 'marche', cluster: 'alternatifs', beta: 1.2, gamma: 0.6, carry: 0.0, neighbors: ['LC_US', 'IMMO', 'EXOT'] },

    // ── Frontière (verrouillées au départ, memo §11) ──
    { id: 'HY_US', label: 'HY US', kind: 'frontiere', cluster: 'credit', beta: 0.9, gamma: 0.85, carry: 0.07, neighbors: ['IG_US', 'LIQ'] },
    { id: 'EXOT', label: 'Dérivés exotiques', kind: 'frontiere', cluster: 'alternatifs', beta: 1.5, gamma: 0.4, carry: 0.0, neighbors: ['PEVC'] },

    // ── Nœuds (non-investissables, memo §11) ──
    { id: 'FED', label: 'Banque centrale', kind: 'noeud', nodeType: 'reglementaire', neighbors: ['IG_US', 'LIQ'] },
    { id: 'LIQ', label: 'Prime broker', kind: 'noeud', nodeType: 'liquidite', neighbors: ['FED', 'INFO', 'HY_US'] },
    { id: 'INFO', label: 'Agence de notation', kind: 'noeud', nodeType: 'information', neighbors: ['IG_US', 'LIQ'] },
  ],
};

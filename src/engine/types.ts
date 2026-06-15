// Types du domaine — la carte. Aucun import DOM/Svelte : testable sans navigateur.

export type HexId = string;

/** Nature d'une case (le canevas stérile servira au futur champ de bataille). */
export type HexKind = 'marche' | 'noeud' | 'frontiere';

export interface Hex {
  id: HexId;
  label: string;
  kind: HexKind;
  /** Adjacence. Doit être symétrique. */
  neighbors: HexId[];
  /** Coordonnées axiales (q, r) — géométrie = adjacence, utilisées par l'UI pour le pavage. */
  coord?: { q: number; r: number };
}

export interface GameMap {
  id: string;
  hexes: Hex[];
}

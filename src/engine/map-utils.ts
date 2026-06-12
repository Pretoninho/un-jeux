// Utilitaires d'intégrité de carte. Réutilisés par les tests (J1) et par le
// chargement de carte (J2+) : une carte étant une donnée interchangeable (spec
// §11bis), le moteur doit pouvoir valider n'importe quelle carte fournie.

import type { GameMap, HexId } from './types';

/**
 * Retourne la liste des problèmes d'adjacence d'une carte :
 *  - voisin inexistant,
 *  - boucle sur soi-même,
 *  - asymétrie (A liste B mais B ne liste pas A).
 * Une carte saine renvoie un tableau vide.
 */
export function mapNeighborProblems(map: GameMap): string[] {
  const ids = new Set(map.hexes.map((h) => h.id));
  const adj = new Map<HexId, Set<HexId>>(
    map.hexes.map((h) => [h.id, new Set(h.neighbors)]),
  );
  const problems: string[] = [];

  for (const hex of map.hexes) {
    for (const n of hex.neighbors) {
      if (n === hex.id) problems.push(`${hex.id} est son propre voisin`);
      if (!ids.has(n)) {
        problems.push(`${hex.id} → voisin inexistant « ${n} »`);
        continue;
      }
      if (!adj.get(n)?.has(hex.id)) {
        problems.push(`adjacence asymétrique : ${hex.id} → ${n} mais pas l'inverse`);
      }
    }
  }
  return problems;
}

/** Vrai si tous les hexes sont atteignables depuis le premier (aucune île). */
export function isConnected(map: GameMap): boolean {
  if (map.hexes.length === 0) return true;
  const adj = new Map<HexId, HexId[]>(
    map.hexes.map((h) => [h.id, h.neighbors]),
  );
  const seen = new Set<HexId>();
  const stack: HexId[] = [map.hexes[0]!.id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const n of adj.get(cur) ?? []) if (!seen.has(n)) stack.push(n);
  }
  return seen.size === map.hexes.length;
}

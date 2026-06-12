// Disposition visuelle de la carte (présentation pure — pas dans le moteur).
// Coordonnées SVG des 13 hexes de mvp-16, calées sur le wireframe (memo §18, écran 2).

export const HEX_R = 42;

export const HEX_POS: Record<string, [number, number]> = {
  IG_EU: [95, 75], IG_US: [200, 75], IG_EM: [305, 75],
  LC_EU: [95, 175], LC_US: [200, 175], LC_EM: [305, 175],
  IMMO: [95, 275], PEVC: [200, 275], HY_US: [305, 275],
  FED: [95, 375], LIQ: [200, 375], INFO: [305, 375], EXOT: [410, 375],
};

export const MAP_W = 505;
export const MAP_H = 450;

/** Points d'un hexagone (flat-top) centré en (cx, cy). */
export function hexPoints(cx: number, cy: number, r = HEX_R): string {
  const h = r * 0.866;
  return [
    [cx + r, cy], [cx + r / 2, cy + h], [cx - r / 2, cy + h],
    [cx - r, cy], [cx - r / 2, cy - h], [cx + r / 2, cy - h],
  ].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/** Couleur de remplissage par nature/cluster d'hexe. */
export function hexFill(kind: string, cluster?: string): string {
  if (kind === 'noeud') return '#3a3f4b';
  const base: Record<string, string> = {
    credit: '#2f5d8a', actions: '#8a3f3f', alternatifs: '#2f7d5a',
  };
  return base[cluster ?? ''] ?? '#555';
}

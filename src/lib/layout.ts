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
  const pts: [number, number][] = [
    [cx + r, cy], [cx + r / 2, cy + h], [cx - r / 2, cy + h],
    [cx - r, cy], [cx - r / 2, cy - h], [cx + r / 2, cy - h],
  ];
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

// ─────────── Pavage de carte générée (coordonnées axiales, pointe en haut) ───────────

const GEN_SIZE = 30; // rayon d'un hexe en px

/** Coordonnée axiale (q, r) → centre pixel (pointe en haut). */
export function axialToPixel(q: number, r: number): [number, number] {
  return [GEN_SIZE * Math.sqrt(3) * (q + r / 2), GEN_SIZE * 1.5 * r];
}

/** Points d'un hexagone POINTE EN HAUT centré en (cx, cy) — pour le pavage généré. */
export function hexPointsPointy(cx: number, cy: number, r = GEN_SIZE): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/** Boîte (viewBox) englobant une liste de centres, avec marge. */
export function genBounds(centers: Array<[number, number]>): { minX: number; minY: number; w: number; h: number } {
  const m = GEN_SIZE + 8;
  const xs = centers.map((c) => c[0]);
  const ys = centers.map((c) => c[1]);
  const minX = Math.min(...xs) - m;
  const minY = Math.min(...ys) - m;
  return { minX, minY, w: Math.max(...xs) + m - minX, h: Math.max(...ys) + m - minY };
}

// ─────────── Pavage 4.8.8 (octogones + carrés) ───────────
// `s` = espacement des centres d'octogones (= largeur plat-à-plat de l'octogone).
//
// `straightFrac` = demi-longueur du côté DROIT de l'octogone, en fraction de `s`. C'est le
// seul curseur du pavage : il fixe d'un coup la taille des octogones ET des carrés, le tout
// restant uniforme et sans trou pour toute valeur dans ]0 ; 0,5[.
//   - = OCTA_REGULAR → octogone régulier (8 côtés égaux), carrés minimaux ;
//   - plus PETIT     → côtés droits raccourcis, biseaux allongés → carrés plus GROS.

/** Demi-côté droit d'un octogone *régulier* (≈ 0,207·s) : tous les côtés sont alors égaux. */
export const OCTA_REGULAR = (Math.SQRT2 - 1) / 2;

/** Points d'un octogone (côtés droits alignés sur les axes) centré en (cx, cy). */
export function octagonPoints(cx: number, cy: number, s: number, straightFrac = OCTA_REGULAR): string {
  const h = s / 2;            // demi plat-à-plat (imposé par l'espacement)
  const t = s * straightFrac; // demi-côté droit (coins d'autant plus biseautés que t est petit)
  const pts: [number, number][] = [
    [-t, -h], [t, -h], [h, -t], [h, t], [t, h], [-t, h], [-h, t], [-h, -t],
  ];
  return pts.map(([x, y]) => `${(cx + x).toFixed(1)},${(cy + y).toFixed(1)}`).join(' ');
}

/** Points du petit carré (losange) qui comble un creux, calé sur les coins des octogones. */
export function diamondPoints(cx: number, cy: number, s: number, straightFrac = OCTA_REGULAR): string {
  const d = s / 2 - s * straightFrac; // demi-diagonale = h − t → arêtes calées sur les biseaux
  const pts: [number, number][] = [[d, 0], [0, d], [-d, 0], [0, -d]];
  return pts.map(([x, y]) => `${(cx + x).toFixed(1)},${(cy + y).toFixed(1)}`).join(' ');
}

/** Couleur de remplissage par nature/cluster d'hexe. */
export function hexFill(kind: string, cluster?: string): string {
  if (kind === 'noeud') return '#3a3f4b';
  const base: Record<string, string> = {
    credit: '#2f5d8a', actions: '#8a3f3f', alternatifs: '#2f7d5a',
  };
  return base[cluster ?? ''] ?? '#555';
}

// Camp / emprunt — financement de départ.
// TS pur, sans DOM. Un seul modèle : dette PERMANENTE, charge fixe à vie.
// Le camp de base (1ᵉʳ emprunt, posé au départ) donne le capital de lancement ET impose
// sa charge : on démarre sous l'eau, ce qui force l'expansion pour la couvrir.

export interface Camp {
  id: string;
  ownerId: string;
  loanAmount: number; // capital emprunté (= dette permanente, jamais soldée)
  chargeRate: number; // fraction du montant dûe par tour
}

let _seq = 0;
export function makeCampId(): string {
  return `camp-${++_seq}`;
}

export function makeCamp(ownerId: string, loanAmount: number, chargeRate: number): Camp {
  if (loanAmount <= 0) throw new Error('loanAmount must be > 0');
  if (chargeRate <= 0) throw new Error('chargeRate must be > 0');
  return { id: makeCampId(), ownerId, loanAmount, chargeRate };
}

/** Charge due par ce camp pour un tour (intérêts fixes sur le montant initial). */
export function campCharge(camp: Camp): number {
  return camp.chargeRate * camp.loanAmount;
}

/** Somme des charges de tous les camps d'un acteur pour un tour. */
export function actorCharges(ownerId: string, camps: Camp[]): number {
  return camps
    .filter((c) => c.ownerId === ownerId)
    .reduce((sum, c) => sum + campCharge(c), 0);
}

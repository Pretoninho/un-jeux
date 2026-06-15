// Brique 3 — Camp / emprunt (financement de départ).
// TS pur, sans DOM. Deux troncs :
//   A (conquérant) : dette permanente, charge fixe à vie.
//   B (rentier)    : dette remboursable, charge proportionnelle au reliquat.

export type Tronc = 'A' | 'B';

export interface Camp {
  id: string;
  ownerId: string;
  loanAmount: number;   // capital initial emprunté (0 pour un camp de base/upkeep)
  chargeRate: number;   // fraction du montant dûe par tour
  tronc: Tronc;
  debtRemaining: number; // Tronc A : toujours = loanAmount ; Tronc B : diminue
  /** Charge fixe directe (camp de base = upkeep pur, sans principal de dette). */
  chargePerTurn?: number;
  /** 'loan' = emprunt avec capital ; 'base' = camp de base (charge sans dette). */
  kind?: 'loan' | 'base';
}

export interface RepayResult {
  camp: Camp;
  repaid: number;
  extinguished: boolean; // true si debtRemaining === 0 après remboursement
}

let _seq = 0;
export function makeCampId(): string {
  return `camp-${++_seq}`;
}

export function makeCamp(
  ownerId: string,
  loanAmount: number,
  tronc: Tronc,
  chargeRate: number,
): Camp {
  if (loanAmount <= 0) throw new Error('loanAmount must be > 0');
  if (chargeRate <= 0) throw new Error('chargeRate must be > 0');
  return {
    id: makeCampId(),
    ownerId,
    loanAmount,
    chargeRate,
    tronc,
    debtRemaining: loanAmount,
    kind: 'loan',
  };
}

/**
 * Camp de BASE : un foyer qui ne rapporte rien mais coûte `chargePerTurn` à vie.
 * Pas de capital reçu, pas de dette (principal 0) → c'est l'upkeep qui motive l'expansion.
 */
export function makeBaseCamp(ownerId: string, chargePerTurn: number): Camp {
  if (chargePerTurn <= 0) throw new Error('chargePerTurn must be > 0');
  return {
    id: makeCampId(),
    ownerId,
    loanAmount: 0,
    chargeRate: 0,
    tronc: 'A',
    debtRemaining: 0,
    chargePerTurn,
    kind: 'base',
  };
}

/** Charge due par ce camp pour un tour. */
export function campCharge(camp: Camp): number {
  if (camp.chargePerTurn != null) return camp.chargePerTurn; // camp de base : charge directe
  if (camp.tronc === 'A') {
    // Charge fixe : intérêts sur le montant initial, pour toujours.
    return camp.chargeRate * camp.loanAmount;
  }
  // Tronc B : charge proportionnelle à la dette restante.
  return camp.chargeRate * camp.debtRemaining;
}

/** Somme des charges de tous les camps d'un acteur pour un tour. */
export function actorCharges(ownerId: string, camps: Camp[]): number {
  return camps
    .filter((c) => c.ownerId === ownerId)
    .reduce((sum, c) => sum + campCharge(c), 0);
}

/** Rembourse `amount` sur un camp Tronc B. Sans effet sur Tronc A. */
export function repayDebt(camp: Camp, amount: number): RepayResult {
  if (camp.tronc === 'A') {
    // Tronc A : dette permanente — remboursement impossible.
    return { camp, repaid: 0, extinguished: false };
  }
  if (amount <= 0 || camp.debtRemaining === 0) {
    return { camp, repaid: 0, extinguished: camp.debtRemaining === 0 };
  }
  const repaid = Math.min(amount, camp.debtRemaining);
  const updated: Camp = { ...camp, debtRemaining: camp.debtRemaining - repaid };
  return { camp: updated, repaid, extinguished: updated.debtRemaining === 0 };
}

export function canRepay(camp: Camp): boolean {
  return camp.tronc === 'B' && camp.debtRemaining > 0;
}

// Lexique des hexes (memo §12 — vocabulaire conservé + tooltips 2 niveaux).
// `court` = survol / icône ? ; `long` = clic pour la mécanique complète.

export interface Entry {
  court: string;
  long: string;
}

export const LEXICON: Record<string, Entry> = {
  IG_EU: { court: 'Crédit Investment Grade — Europe.', long: 'Obligations d’entreprises bien notées (EU). Défensif : beta faible, carry régulier, peu volatil. Souffre surtout des hausses de taux et de l’écartement des spreads de crédit.' },
  IG_US: { court: 'Crédit Investment Grade — US.', long: 'Le cœur du cluster crédit, très connecté (voisin des actions US, du High Yield et des nœuds). C’est souvent par là que se propage la contagion en crise.' },
  IG_EM: { court: 'Crédit Investment Grade — Émergents.', long: 'Crédit de qualité émergent : carry plus élevé, beta plus haut que l’IG développé. Plus sensible aux régimes de marché.' },
  LC_EU: { court: 'Actions grandes capitalisations — Europe.', long: 'Beta marché élevé : moteur de rendement en bull, premier exposé aux corrections. Carry (dividende) modéré.' },
  LC_US: { court: 'Actions grandes capitalisations — US.', long: 'Position de départ de l’analyste du Vautour : cœur de marché, bien connecté. Forte exposition au facteur marché M.' },
  LC_EM: { court: 'Actions grandes capitalisations — Émergents.', long: 'Le beta le plus élevé de la carte : gains amplifiés en bull, pertes amplifiées en crise.' },
  IMMO: { court: 'Immobilier.', long: 'Carry élevé (loyers) mais sensible aux taux et illiquide : en sortir en taille a un impact prix marqué.' },
  PEVC: { court: 'Private Equity / Venture Capital.', long: 'Haut beta, illiquide, sans carry : la performance arrive tard. Pont vers les dérivés exotiques (frontière).' },
  HY_US: { court: 'Crédit High Yield US (frontière, verrouillé).', long: 'Crédit risqué à carry élevé — le plus fragile du cluster crédit, souvent le premier à craquer. Marché frontière : déblocable plus tard.' },
  EXOT: { court: 'Dérivés exotiques (frontière, verrouillé).', long: 'Marché complexe et illiquide, verrouillé au départ. Réservé aux builds avancés.' },
  FED: { court: 'Banque centrale (nœud réglementaire).', long: 'Fixe les taux en réaction à l’état du marché — météo régulatoire, pas un concurrent. Y être présent donne une lecture anticipée des taux à venir.' },
  LIQ: { court: 'Prime broker (nœud liquidité).', long: 'Rend le levier moins cher, mais accroît la contribution à la fragilité. Présence requise pour acquérir le signal Financement.' },
  INFO: { court: 'Agence de notation (nœud information).', long: 'Rend les signaux moins bruités et moins retardés. Améliore la lecture sans jamais la rendre certaine.' },
};

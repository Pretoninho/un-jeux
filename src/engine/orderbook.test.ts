import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeOrderBook,
  postOrder,
  cancelOrder,
  displayPrice,
  makeOrderId,
  type Order,
  type OrderBook,
} from './orderbook';
import type { ActorState } from './state';

// ─────────────────────── Helpers ─────────────────────────────────────────────

function makeActor(id: string, cash: number, sharesOnHex?: { hexId: string; shares: number }): ActorState {
  return {
    id,
    cash,
    positions: sharesOnHex
      ? [{ hexId: sharesOnHex.hexId, direction: 'long', equity: sharesOnHex.shares, leverage: 0, entryV: 10 }]
      : [],
    couponPositions: [],
    wealthHistory: [],
  } as unknown as ActorState;
}

function order(actorId: string, side: 'buy' | 'sell', price: number, shares: number, hexId = 'H1'): Order {
  return { id: makeOrderId(), actorId, hexId, side, price, shares };
}

// ─────────────────────── Tests ────────────────────────────────────────────────

describe('orderbook — carnet vide', () => {
  it('affiche null si aucun ordre', () => {
    const book = makeOrderBook('H1');
    expect(displayPrice(book)).toBeNull();
  });

  it('affiche le prix de la meilleure vente sans échange', () => {
    const book = makeOrderBook('H1');
    const alice = makeActor('alice', 0, { hexId: 'H1', shares: 5 });
    postOrder(book, order('alice', 'sell', 12, 3), [alice]);
    expect(displayPrice(book)).toBe(12);
  });

  it('affiche le prix du meilleur achat sans échange', () => {
    const book = makeOrderBook('H1');
    const bob = makeActor('bob', 1000);
    postOrder(book, order('bob', 'buy', 10, 2), [bob]);
    expect(displayPrice(book)).toBe(10);
  });
});

describe('orderbook — appariement immédiat', () => {
  let book: OrderBook;
  let alice: ActorState;
  let bob: ActorState;

  beforeEach(() => {
    book = makeOrderBook('H1');
    alice = makeActor('alice', 0, { hexId: 'H1', shares: 5 });
    bob = makeActor('bob', 500);
  });

  it('SI achat ≥ meilleure vente → échange au prix de la vente (qui attendait)', () => {
    // Alice pose une offre de vente à 10
    postOrder(book, order('alice', 'sell', 10, 3), [alice, bob]);
    expect(book.asks).toHaveLength(1);

    // Bob achète à 12 → croise à 10 (prix de l'attente)
    const { trades } = postOrder(book, order('bob', 'buy', 12, 3), [alice, bob]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.price).toBe(10);
    expect(trades[0]!.shares).toBe(3);
    expect(trades[0]!.buyerId).toBe('bob');
    expect(trades[0]!.sellerId).toBe('alice');
  });

  it('après échange : lastPrice = prix du trade', () => {
    postOrder(book, order('alice', 'sell', 10, 2), [alice, bob]);
    postOrder(book, order('bob', 'buy', 15, 2), [alice, bob]);
    expect(book.lastPrice).toBe(10);
    expect(displayPrice(book)).toBe(10);
  });

  it('transfert cash → acheteur paie, vendeur encaisse', () => {
    postOrder(book, order('alice', 'sell', 10, 2), [alice, bob]);
    postOrder(book, order('bob', 'buy', 10, 2), [alice, bob]);

    expect(bob.cash).toBe(500 - 10 * 2);
    expect(alice.cash).toBe(10 * 2);
  });

  it('transfert parts → acheteur reçoit, vendeur cède', () => {
    postOrder(book, order('alice', 'sell', 10, 2), [alice, bob]);
    postOrder(book, order('bob', 'buy', 10, 2), [alice, bob]);

    const aliceShares = alice.positions.find(p => p.hexId === 'H1')?.equity ?? 0;
    const bobShares = bob.positions.find(p => p.hexId === 'H1')?.equity ?? 0;

    expect(aliceShares).toBe(3); // 5 - 2
    expect(bobShares).toBe(2);
  });

  it('SI achat < meilleure vente → pas d\'échange, ordre mis en attente', () => {
    postOrder(book, order('alice', 'sell', 15, 2), [alice, bob]);
    const { trades, remainder } = postOrder(book, order('bob', 'buy', 10, 2), [alice, bob]);

    expect(trades).toHaveLength(0);
    expect(remainder).not.toBeNull();
    expect(book.bids).toHaveLength(1);
    expect(book.bids[0]!.price).toBe(10);
  });
});

describe('orderbook — appariement depuis l\'autre sens', () => {
  it('SI vente ≤ meilleur achat → échange au prix de l\'achat (qui attendait)', () => {
    const book = makeOrderBook('H1');
    const alice = makeActor('alice', 0, { hexId: 'H1', shares: 5 });
    const bob = makeActor('bob', 500);

    // Bob pose un achat à 12
    postOrder(book, order('bob', 'buy', 12, 3), [alice, bob]);
    expect(book.bids).toHaveLength(1);

    // Alice vend à 10 → croise à 12 (prix de l'attente)
    const { trades } = postOrder(book, order('alice', 'sell', 10, 3), [alice, bob]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.price).toBe(12); // prix de l'ordre qui attendait
    expect(trades[0]!.buyerId).toBe('bob');
    expect(trades[0]!.sellerId).toBe('alice');
  });
});

describe('orderbook — remplissage partiel', () => {
  it('appariement partiel : reliquat reste dans le carnet', () => {
    const book = makeOrderBook('H1');
    const alice = makeActor('alice', 0, { hexId: 'H1', shares: 5 });
    const bob = makeActor('bob', 500);

    // Alice vend 5 parts à 10
    postOrder(book, order('alice', 'sell', 10, 5), [alice, bob]);

    // Bob achète seulement 3 → reste 2 dans le carnet côté ask
    const { trades, remainder } = postOrder(book, order('bob', 'buy', 10, 3), [alice, bob]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.shares).toBe(3);
    expect(remainder).toBeNull(); // l'acheteur est rempli
    expect(book.asks).toHaveLength(1);
    expect(book.asks[0]!.shares).toBe(2); // reliquat côté vendeur
  });

  it('acheteur partiellement rempli : reliquat dans les bids', () => {
    const book = makeOrderBook('H1');
    const alice = makeActor('alice', 0, { hexId: 'H1', shares: 2 });
    const bob = makeActor('bob', 500);

    // Alice ne peut vendre que 2 parts
    postOrder(book, order('alice', 'sell', 10, 2), [alice, bob]);

    // Bob veut en acheter 5
    const { trades, remainder } = postOrder(book, order('bob', 'buy', 10, 5), [alice, bob]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.shares).toBe(2);
    expect(remainder).not.toBeNull();
    expect(remainder!.shares).toBe(3);
    expect(book.bids).toHaveLength(1);
    expect(book.bids[0]!.shares).toBe(3);
  });
});

describe('orderbook — ordres multiples et tri du carnet', () => {
  it('les asks sont triés par prix croissant (moins cher en tête)', () => {
    const book = makeOrderBook('H1');
    const alice = makeActor('alice', 0, { hexId: 'H1', shares: 10 });

    postOrder(book, order('alice', 'sell', 15, 1), [alice]);
    postOrder(book, order('alice', 'sell', 12, 1), [alice]);
    postOrder(book, order('alice', 'sell', 20, 1), [alice]);

    expect(book.asks.map(o => o.price)).toEqual([12, 15, 20]);
  });

  it('les bids sont triés par prix décroissant (plus offrant en tête)', () => {
    const book = makeOrderBook('H1');
    const bob = makeActor('bob', 5000);

    postOrder(book, order('bob', 'buy', 8, 1), [bob]);
    postOrder(book, order('bob', 'buy', 12, 1), [bob]);
    postOrder(book, order('bob', 'buy', 10, 1), [bob]);

    expect(book.bids.map(o => o.price)).toEqual([12, 10, 8]);
  });

  it('l\'appariement passe par le meilleur ask en premier', () => {
    const book = makeOrderBook('H1');
    const alice = makeActor('alice', 0, { hexId: 'H1', shares: 10 });
    const bob = makeActor('bob', 5000);

    // Deux vendeurs à des prix différents
    postOrder(book, order('alice', 'sell', 15, 2), [alice, bob]);
    postOrder(book, order('alice', 'sell', 10, 2), [alice, bob]);

    // Bob achète 2 → doit croiser avec ask à 10 (le moins cher)
    const { trades } = postOrder(book, order('bob', 'buy', 20, 2), [alice, bob]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.price).toBe(10);
    expect(book.asks).toHaveLength(1);
    expect(book.asks[0]!.price).toBe(15); // l'autre reste
  });
});

describe('orderbook — protections (long-only, cash)', () => {
  it('refus si vendeur sans parts', () => {
    const book = makeOrderBook('H1');
    const alice = makeActor('alice', 1000); // pas de parts

    const { trades, remainder } = postOrder(book, order('alice', 'sell', 10, 3), [alice]);

    expect(trades).toHaveLength(0);
    expect(remainder).toBeNull();
    expect(book.asks).toHaveLength(0);
  });

  it('refus si acheteur sans cash suffisant', () => {
    const book = makeOrderBook('H1');
    const bob = makeActor('bob', 5); // pas assez pour 10 × 3 = 30

    const { trades, remainder } = postOrder(book, order('bob', 'buy', 10, 3), [bob]);

    expect(trades).toHaveLength(0);
    expect(remainder).toBeNull();
    expect(book.bids).toHaveLength(0);
  });
});

describe('orderbook — annulation', () => {
  it('cancel retire l\'ordre du carnet', () => {
    const book = makeOrderBook('H1');
    const bob = makeActor('bob', 500);
    const o = order('bob', 'buy', 10, 2);
    postOrder(book, o, [bob]);
    expect(book.bids).toHaveLength(1);

    const ok = cancelOrder(book, o.id);
    expect(ok).toBe(true);
    expect(book.bids).toHaveLength(0);
  });

  it('cancel d\'un id inconnu retourne false', () => {
    const book = makeOrderBook('H1');
    expect(cancelOrder(book, 'inexistant')).toBe(false);
  });
});

describe('orderbook — zéro-sum', () => {
  it('la richesse totale (cash + parts × prix) est conservée à chaque échange', () => {
    const book = makeOrderBook('H1');
    const alice = makeActor('alice', 100, { hexId: 'H1', shares: 5 });
    const bob = makeActor('bob', 200);

    const wealthBefore = (a: ActorState) =>
      a.cash + (a.positions.find(p => p.hexId === 'H1')?.equity ?? 0) * 10;

    const totalBefore = wealthBefore(alice) + wealthBefore(bob);

    postOrder(book, order('alice', 'sell', 10, 3), [alice, bob]);
    postOrder(book, order('bob', 'buy', 10, 3), [alice, bob]);

    const totalAfter = wealthBefore(alice) + wealthBefore(bob);
    expect(totalAfter).toBeCloseTo(totalBefore, 6);
  });
});

// Carnet d'ordres par hexe-marché.
//
// Règles SI→ALORS (visibles par tous) :
//   SI une offre de vente croise une offre d'achat (prix_achat ≥ prix_vente)
//     → échange au prix de l'offre qui ATTENDAIT dans le carnet
//     → acheteur donne cash, reçoit parts ; vendeur donne parts, reçoit cash
//     → prix affiché = prix du dernier échange
//   SINON l'offre rejoint le carnet (visible de tous)
//
// Contraintes de base :
//   - Long-only : pas de vente sans parts en portefeuille
//   - Parts entières uniquement
//   - Prix en unités entières (pas de fractions)

import type { HexId } from './types';
import type { ActorState } from './state';

// ─────────────────────────── Types publics ───────────────────────────────────

export type OrderSide = 'buy' | 'sell';

export interface Order {
  id: string;
  actorId: string;
  hexId: HexId;
  side: OrderSide;
  /** Prix limite (unités entières). */
  price: number;
  /** Nombre de parts demandées (entier ≥ 1). */
  shares: number;
}

export interface Trade {
  buyerId: string;
  sellerId: string;
  hexId: HexId;
  price: number;
  shares: number;
}

export interface OrderBook {
  hexId: HexId;
  /** Offres d'achat triées par prix DÉCROISSANT (meilleur acheteur en tête). */
  bids: Order[];
  /** Offres de vente triées par prix CROISSANT (meilleur vendeur en tête). */
  asks: Order[];
  /** Prix du dernier échange. `null` si aucun échange n'a encore eu lieu. */
  lastPrice: number | null;
}

export interface PostResult {
  trades: Trade[];
  /** Ordres restants après appariement partiel (vide si rempli ou mis en attente). */
  remainder: Order | null;
}

// ─────────────────────────── Helpers internes ────────────────────────────────

let _nextId = 1;
export function makeOrderId(): string {
  return `ord-${_nextId++}`;
}

/** Parts détenues par un acteur sur un hexe (positions long uniquement). */
function sharesHeld(actor: ActorState, hexId: HexId): number {
  return actor.positions
    .filter(p => p.hexId === hexId && p.direction === 'long')
    .reduce((sum, p) => {
      // On approxime : 1 part = 1 unité d'equity (convention provisoire jusqu'au wiring complet)
      return sum + Math.floor(p.equity);
    }, 0);
}

/** Transfert atomique cash ↔ parts entre deux acteurs lors d'un échange. */
function applyTrade(
  trade: Trade,
  actors: ActorState[],
  hexId: HexId,
): void {
  const buyer = actors.find(a => a.id === trade.buyerId);
  const seller = actors.find(a => a.id === trade.sellerId);
  if (!buyer || !seller) return;

  const total = trade.price * trade.shares;

  // Acheteur : paie cash, reçoit parts (position long sur l'hexe)
  buyer.cash -= total;
  const existing = buyer.positions.find(p => p.hexId === hexId && p.direction === 'long');
  if (existing) {
    existing.equity += trade.shares;
  } else {
    buyer.positions.push({
      hexId,
      direction: 'long',
      equity: trade.shares,
      leverage: 0,
      entryV: trade.price,
    });
  }

  // Vendeur : reçoit cash, rend parts
  seller.cash += total;
  let toReturn = trade.shares;
  for (const pos of seller.positions) {
    if (pos.hexId !== hexId || pos.direction !== 'long' || toReturn <= 0) continue;
    const take = Math.min(Math.floor(pos.equity), toReturn);
    pos.equity -= take;
    toReturn -= take;
  }
  // Nettoyage des positions vidées
  seller.positions = seller.positions.filter(p => p.equity > 0);
}

// ─────────────────────────── API publique ────────────────────────────────────

/** Crée un carnet d'ordres vide pour un hexe. */
export function makeOrderBook(hexId: HexId): OrderBook {
  return { hexId, bids: [], asks: [], lastPrice: null };
}

/**
 * Poste un ordre dans le carnet et apparie immédiatement si possible.
 *
 * Retourne les échanges réalisés et l'éventuel reliquat (ordre partiellement
 * rempli ou non croisé).
 *
 * Pré-conditions vérifiées :
 *   - Acheteur : cash suffisant pour couvrir le pire cas (prix × parts)
 *   - Vendeur  : parts suffisantes en portefeuille
 */
export function postOrder(
  book: OrderBook,
  order: Order,
  actors: ActorState[],
): PostResult {
  const trades: Trade[] = [];
  let remaining = order.shares;

  if (order.side === 'buy') {
    const buyer = actors.find(a => a.id === order.actorId);
    if (!buyer || buyer.cash < order.price * order.shares) {
      return { trades: [], remainder: null };
    }

    // Appariement : parcourt les asks du moins cher au plus cher
    while (remaining > 0 && book.asks.length > 0) {
      const bestAsk = book.asks[0];
      if (bestAsk.price > order.price) break; // plus de croisement possible

      const fill = Math.min(remaining, bestAsk.shares);
      const trade: Trade = {
        buyerId: order.actorId,
        sellerId: bestAsk.actorId,
        hexId: book.hexId,
        price: bestAsk.price, // prix de l'ordre qui attendait
        shares: fill,
      };
      trades.push(trade);
      applyTrade(trade, actors, book.hexId);
      book.lastPrice = trade.price;

      bestAsk.shares -= fill;
      remaining -= fill;
      if (bestAsk.shares === 0) book.asks.shift();
    }
  } else {
    // SELL
    const seller = actors.find(a => a.id === order.actorId);
    if (!seller || sharesHeld(seller, book.hexId) < order.shares) {
      return { trades: [], remainder: null };
    }

    // Appariement : parcourt les bids du plus cher au moins cher
    while (remaining > 0 && book.bids.length > 0) {
      const bestBid = book.bids[0];
      if (bestBid.price < order.price) break;

      const fill = Math.min(remaining, bestBid.shares);
      const trade: Trade = {
        buyerId: bestBid.actorId,
        sellerId: order.actorId,
        hexId: book.hexId,
        price: bestBid.price, // prix de l'ordre qui attendait
        shares: fill,
      };
      trades.push(trade);
      applyTrade(trade, actors, book.hexId);
      book.lastPrice = trade.price;

      bestBid.shares -= fill;
      remaining -= fill;
      if (bestBid.shares === 0) book.bids.shift();
    }
  }

  // S'il reste des parts non appariées → mise en attente dans le carnet
  let remainder: Order | null = null;
  if (remaining > 0) {
    remainder = { ...order, shares: remaining };
    if (order.side === 'buy') {
      book.bids.push(remainder);
      book.bids.sort((a, b) => b.price - a.price); // décroissant
    } else {
      book.asks.push(remainder);
      book.asks.sort((a, b) => a.price - b.price); // croissant
    }
  }

  return { trades, remainder };
}

/**
 * Annule un ordre en attente (par id).
 * Retourne `true` si l'ordre a été trouvé et retiré.
 */
export function cancelOrder(book: OrderBook, orderId: string): boolean {
  const bidIdx = book.bids.findIndex(o => o.id === orderId);
  if (bidIdx >= 0) { book.bids.splice(bidIdx, 1); return true; }
  const askIdx = book.asks.findIndex(o => o.id === orderId);
  if (askIdx >= 0) { book.asks.splice(askIdx, 1); return true; }
  return false;
}

/** Prix affiché : dernier échange, ou meilleure offre disponible, ou null. */
export function displayPrice(book: OrderBook): number | null {
  if (book.lastPrice !== null) return book.lastPrice;
  if (book.asks.length > 0) return book.asks[0].price;
  if (book.bids.length > 0) return book.bids[0].price;
  return null;
}

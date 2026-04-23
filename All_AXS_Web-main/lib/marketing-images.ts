/**
 * Remote hero & section art (Unsplash — follow their license and photographer attribution).
 *
 * **African-first:** Picks skew toward shoots from Unsplash “African business meeting” / similar
 * professional indexes (teams, panels, and workspaces) so marketing reads pan-African tech
 * summit, not generic Western-only stock or nightclub scenes.
 */
function u(id: string, w: number, q = 82): string {
  return `https://images.unsplash.com/${id}?ixlib=rb-4.0.3&auto=format&fit=crop&w=${w}&q=${q}`;
}

export const marketingImages = {
  /** Home hero — daylight team session in a modern room */
  homeHero: u("photo-1573164574511-73c773193279", 2400),
  /** Wide parallax — panel / speakers in a modern room */
  parallaxSummit: u("photo-1776039325163-f45315a484f3", 2000),
  /** Second parallax — collaborative lounge working session */
  parallaxSession: u("photo-1655720357872-ce227e4164ba", 2000),
  /** Journey card — Discover */
  journeyDiscover: u("photo-1573164574308-edcb95e8b261", 1200),
  /** Journey card — Checkout — focused work at a laptop */
  journeyCheckout: u("photo-1573164574001-518958d9baa2", 1200),
  /** Journey card — Attend — group working together at a table */
  journeyAttend: u("photo-1573164574572-cb89e39749b4", 1200),
  /** Home buyer protection band */
  buyerBand: "/images/hero-3.jpg",
  /** Organizer column — two colleagues with laptops */
  organizerSide: u("photo-1573164574048-f968d7ee9f20", 1400),
  /** Testimonial avatars */
  quoteA: u("photo-1573496359142-b8d87734a5a2", 800),
  quoteB: u("photo-1758519289200-384c7ef2d163", 800),
  quoteC: u("photo-1573164574144-649081e9421a", 800),
  /** Trust strip */
  trustFees: u("photo-1454165804606-c3d57bc86b40", 900),
  trustQr: u("photo-1758876202167-f81c995c3fdc", 900),
  trustVetted: u("photo-1594098882270-66ce9399b040", 900),
  trustPay: u("photo-1758519290277-97c47f189860", 900),
  /**
   * `/organizers` marketing:
   * - Hero: local `public/images/gem_hero.png` (brand art).
   * - Section art: Getty “African business / boardroom / collaboration” Unsplash series
   *   (`photo-157316457*`, `photo-160088029*`) — pan‑African professional context, distinct frames per slot.
   */
  organizerHero: "/images/gem_hero.png",
  organizerTiers: u("photo-1573164574572-cb89e39749b4", 1600),
  organizerMedia: u("photo-1573164574397-dd250bc8a598", 1600),
  organizerGate: u("photo-1573164574308-edcb95e8b261", 1600),
  organizerPayouts: u("photo-1573164574001-518958d9baa2", 1600),
  organizerTeam: u("photo-1573164574048-f968d7ee9f20", 1400),
  /** `/organizers` — On site parallax band */
  organizerParallax: "/images/hero_image1232.jpeg",
  organizerChecklist: u("photo-1573164574144-649081e9421a", 1600),
} as const;

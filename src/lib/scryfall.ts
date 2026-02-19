// Scryfall API client with rate limiting

const BASE_URL = 'https://api.scryfall.com'

// Simple rate limiter: max 10 req/s, queue requests
let lastRequest = 0
const MIN_INTERVAL = 100 // 100ms between requests

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now()
  const elapsed = now - lastRequest
  if (elapsed < MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - elapsed))
  }
  lastRequest = Date.now()
  return fetch(url, options)
}

export interface ScryfallCard {
  id: string
  name: string
  set: string
  set_name: string
  collector_number: string
  lang: string
  mana_cost?: string
  cmc: number
  type_line: string
  oracle_text?: string
  colors?: string[]
  color_identity: string[]
  power?: string
  toughness?: string
  loyalty?: string
  rarity: string
  image_uris?: {
    small: string
    normal: string
    large: string
    png: string
    art_crop: string
    border_crop: string
  }
  card_faces?: Array<{
    name: string
    mana_cost?: string
    type_line: string
    oracle_text?: string
    image_uris?: {
      small: string
      normal: string
      large: string
      png: string
      art_crop: string
      border_crop: string
    }
  }>
  prices: {
    usd?: string
    usd_foil?: string
    eur?: string
    eur_foil?: string
  }
  legalities: Record<string, string>
  keywords: string[]
  released_at: string
  uri: string
  scryfall_uri: string
}

export interface ScryfallSearchResponse {
  object: 'list'
  total_cards: number
  has_more: boolean
  next_page?: string
  data: ScryfallCard[]
}

export interface ScryfallSet {
  id: string
  code: string
  name: string
  set_type: string
  released_at?: string
  card_count: number
  icon_svg_uri: string
  scryfall_uri: string
  search_uri: string
  parent_set_code?: string
}

// A group of precon decks under a common expansion or category
export interface PreconGroup {
  key: string           // parent set code, or set type category for standalones
  label: string         // Display name (parent expansion name, or type label)
  releasedAt?: string   // For sorting
  isExpansion: boolean  // true if grouped under a real parent expansion
  decks: ScryfallSet[]
}

export interface ScryfallSetsResponse {
  object: 'list'
  data: ScryfallSet[]
}

// Search cards by query string (Scryfall syntax supported)
export async function searchCards(query: string, page = 1): Promise<ScryfallSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    order: 'name'
  })
  const res = await rateLimitedFetch(`${BASE_URL}/cards/search?${params}`)
  if (res.status === 404) {
    return { object: 'list', total_cards: 0, has_more: false, data: [] }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ details: res.statusText }))
    throw new Error(err.details || `Scryfall error: ${res.status}`)
  }
  return res.json()
}

// Get a single card by Scryfall ID
export async function getCard(id: string): Promise<ScryfallCard> {
  const res = await rateLimitedFetch(`${BASE_URL}/cards/${id}`)
  if (!res.ok) {
    throw new Error(`Card not found: ${id}`)
  }
  return res.json()
}

// Get all sets (for filtering precons)
export async function getSets(): Promise<ScryfallSetsResponse> {
  const res = await rateLimitedFetch(`${BASE_URL}/sets`)
  if (!res.ok) {
    throw new Error('Failed to fetch sets')
  }
  return res.json()
}

const PRECON_TYPES = ['commander', 'duel_deck', 'planechase', 'archenemy', 'from_the_vault', 'starter']

// Get precon sets grouped by parent expansion; standalone sets each form their own group
export async function getGroupedPrecons(): Promise<PreconGroup[]> {
  const { data } = await getSets()

  const byCode = new Map<string, ScryfallSet>()
  data.forEach(s => byCode.set(s.code, s))

  const precons = data.filter(s => PRECON_TYPES.includes(s.set_type))
  const groups = new Map<string, PreconGroup>()

  for (const deck of precons) {
    const parentCode = deck.parent_set_code
    const parent = parentCode ? byCode.get(parentCode) : undefined

    if (parent && !PRECON_TYPES.includes(parent.set_type)) {
      // Group under the parent expansion (e.g. "March of the Machine" groups moc)
      if (!groups.has(parentCode!)) {
        groups.set(parentCode!, {
          key: parentCode!,
          label: parent.name,
          releasedAt: parent.released_at || deck.released_at,
          isExpansion: true,
          decks: []
        })
      }
      groups.get(parentCode!)!.decks.push(deck)
    } else {
      // Standalone: each set is its own group (Commander 2021, Fallout, Doctor Who…)
      groups.set(deck.code, {
        key: deck.code,
        label: deck.name,
        releasedAt: deck.released_at,
        isExpansion: false,
        decks: [deck]
      })
    }
  }

  // Sort all groups by release date, newest first
  return Array.from(groups.values()).sort((a, b) =>
    (b.releasedAt ?? '').localeCompare(a.releasedAt ?? '')
  )
}

// Fetch the face commander(s) for a single precon deck set.
// Sorts by collector number ascending — the face commander is always first.
// Returns 1 card normally, 2 for partner pairs.
export async function getSetCommanders(setCode: string): Promise<ScryfallCard[]> {
  const params = new URLSearchParams({
    q: `set:${setCode} t:legendary t:creature -is:reprint`,
    order: 'set',
    dir: 'asc',
    page: '1'
  })
  const res = await rateLimitedFetch(`${BASE_URL}/cards/search?${params}`)

  let data: ScryfallSearchResponse | null = null

  if (res.status === 404) {
    // Fallback: older sets may only have reprint legends
    const params2 = new URLSearchParams({
      q: `set:${setCode} t:legendary t:creature`,
      order: 'set',
      dir: 'asc',
      page: '1'
    })
    const res2 = await rateLimitedFetch(`${BASE_URL}/cards/search?${params2}`)
    if (!res2.ok) return []
    data = await res2.json()
  } else if (res.ok) {
    data = await res.json()
  } else {
    return []
  }

  if (!data || data.data.length === 0) return []

  const first = data.data[0]
  // Partner pairs: both cards share the "Partner" keyword
  if (
    first.keywords?.includes('Partner') &&
    data.data.length > 1 &&
    data.data[1].keywords?.includes('Partner')
  ) {
    return [first, data.data[1]]
  }
  return [first]
}

// Get precon/commander sets (flat list, kept for backwards compat)
export async function getPreconSets(): Promise<ScryfallSet[]> {
  const { data } = await getSets()
  return data.filter(s => PRECON_TYPES.includes(s.set_type))
}

// Get all cards in a set
export async function getSetCards(setCode: string, page = 1): Promise<ScryfallSearchResponse> {
  return searchCards(`set:${setCode}`, page)
}

// Batch lookup by collection (POST /cards/collection)
export async function getCardsByCollection(
  identifiers: Array<{ id?: string; name?: string }>
): Promise<ScryfallCard[]> {
  const res = await rateLimitedFetch(`${BASE_URL}/cards/collection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers })
  })
  if (!res.ok) {
    throw new Error('Failed to fetch collection')
  }
  const data = await res.json()
  return data.data || []
}

// Helper: get the best image URI from a card
export function getCardImageUri(card: ScryfallCard, size: 'small' | 'normal' | 'large' = 'normal'): string {
  if (card.image_uris) {
    return card.image_uris[size]
  }
  // Double-faced card: use front face
  if (card.card_faces && card.card_faces[0]?.image_uris) {
    return card.card_faces[0].image_uris[size]
  }
  return ''
}

// Get a single card by exact name (fuzzy fallback)
export async function getCardByName(name: string): Promise<ScryfallCard | null> {
  const res = await rateLimitedFetch(`${BASE_URL}/cards/named?exact=${encodeURIComponent(name)}`)
  if (res.ok) return res.json()
  if (res.status === 404) {
    const res2 = await rateLimitedFetch(`${BASE_URL}/cards/named?fuzzy=${encodeURIComponent(name)}`)
    if (res2.ok) return res2.json()
  }
  return null
}

// Search with explicit order override (bypasses the default name ordering)
export async function searchCardsOrdered(query: string, order: string, page = 1): Promise<ScryfallSearchResponse> {
  const params = new URLSearchParams({ q: query, order, page: page.toString() })
  const res = await rateLimitedFetch(`${BASE_URL}/cards/search?${params}`)
  if (res.status === 404) return { object: 'list', total_cards: 0, has_more: false, data: [] }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ details: res.statusText }))
    throw new Error(err.details || `Scryfall error: ${res.status}`)
  }
  return res.json()
}

// Helper: get mana cost display
export function getManaCost(card: ScryfallCard): string {
  if (card.mana_cost) return card.mana_cost
  if (card.card_faces && card.card_faces[0]?.mana_cost) {
    return card.card_faces[0].mana_cost || ''
  }
  return ''
}

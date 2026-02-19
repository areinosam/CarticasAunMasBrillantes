// MTGJSON API client for individual precon deck lists
// Scryfall bundles all decks in a product under one set code; MTGJSON has individual deck data.

const BASE_URL = 'https://mtgjson.com/api/v5'

let lastRequest = 0
const MIN_INTERVAL = 150

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now()
  const elapsed = now - lastRequest
  if (elapsed < MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - elapsed))
  }
  lastRequest = Date.now()
  return fetch(url)
}

export interface MTGJSONDeckMeta {
  code: string        // e.g., "BLC"
  fileName: string    // e.g., "AnimatedArmy_BLC"
  name: string        // e.g., "Animated Army"
  releaseDate: string // e.g., "2024-08-02"
  type: string        // e.g., "Commander Deck"
}

export interface MTGJSONCardIdentifiers {
  scryfallId?: string
  multiverseId?: string
  mtgoId?: string
}

export interface MTGJSONDeckCard {
  count: number
  name: string
  uuid: string
  number?: string
  identifiers: MTGJSONCardIdentifiers
}

export interface MTGJSONDeckData {
  code: string
  name: string
  releaseDate: string
  type: string
  commander: MTGJSONDeckCard[]
  mainBoard: MTGJSONDeckCard[]
  sideBoard?: MTGJSONDeckCard[]
}

// Deck types to show in the Precons page
export const PRECON_DECK_TYPES = [
  'Commander Deck',
  'Duel Deck',
  'Planechase',
  'Archenemy',
  'Starter Kit',
]

export async function getDeckList(): Promise<MTGJSONDeckMeta[]> {
  const res = await rateLimitedFetch(`${BASE_URL}/DeckList.json`)
  if (!res.ok) throw new Error('Failed to fetch MTGJSON deck list')
  const json = await res.json()
  return json.data || []
}

export async function getDeck(fileName: string): Promise<MTGJSONDeckData> {
  const res = await rateLimitedFetch(`${BASE_URL}/decks/${fileName}.json`)
  if (!res.ok) throw new Error(`Failed to fetch deck: ${fileName}`)
  const json = await res.json()
  return json.data
}

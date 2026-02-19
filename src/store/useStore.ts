import { create } from 'zustand'
import { storageGet, storageSet } from '@/lib/storage'

export interface CollectionCard {
  scryfallId: string
  name: string
  set: string
  setName: string
  quantity: number
  foil: boolean
  condition: 'M' | 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'
  imageUri?: string
  manaCost?: string
  typeLine: string
  colors: string[]
  addedAt: string
}

export interface DeckCard {
  scryfallId: string
  name: string
  quantity: number
  board: 'main' | 'sideboard' | 'commander'
  imageUri?: string
  manaCost?: string
  typeLine?: string
  colors?: string[]
}

export interface Deck {
  id: string
  name: string
  format: string
  description?: string
  createdAt: string
  updatedAt: string
  cards: DeckCard[]
}

interface StoreState {
  collection: CollectionCard[]
  decks: Deck[]
  initialized: boolean

  // Collection actions
  initStore: () => Promise<void>
  addToCollection: (card: Omit<CollectionCard, 'addedAt'>) => Promise<void>
  removeFromCollection: (scryfallId: string) => Promise<void>
  updateCardQuantity: (scryfallId: string, quantity: number) => Promise<void>
  isInCollection: (scryfallId: string) => boolean
  getCollectionCard: (scryfallId: string) => CollectionCard | undefined

  // Deck actions
  createDeck: (name: string, format: string, description?: string) => Promise<Deck>
  deleteDeck: (deckId: string) => Promise<void>
  updateDeck: (deckId: string, updates: Partial<Omit<Deck, 'id' | 'createdAt' | 'cards'>>) => Promise<void>
  addCardToDeck: (deckId: string, card: DeckCard) => Promise<void>
  removeCardFromDeck: (deckId: string, scryfallId: string, board: DeckCard['board']) => Promise<void>
  updateDeckCardQuantity: (deckId: string, scryfallId: string, board: DeckCard['board'], quantity: number) => Promise<void>
  getDeck: (deckId: string) => Deck | undefined
}

export const useStore = create<StoreState>((set, get) => ({
  collection: [],
  decks: [],
  initialized: false,

  initStore: async () => {
    if (get().initialized) return
    const collection = await storageGet<CollectionCard[]>('collection', [])
    const decks = await storageGet<Deck[]>('decks', [])
    set({ collection, decks, initialized: true })
  },

  addToCollection: async (cardData) => {
    const { collection } = get()
    const existing = collection.find(c => c.scryfallId === cardData.scryfallId && c.foil === cardData.foil)

    let newCollection: CollectionCard[]
    if (existing) {
      newCollection = collection.map(c =>
        c.scryfallId === cardData.scryfallId && c.foil === cardData.foil
          ? { ...c, quantity: c.quantity + cardData.quantity }
          : c
      )
    } else {
      const newCard: CollectionCard = {
        ...cardData,
        addedAt: new Date().toISOString()
      }
      newCollection = [...collection, newCard]
    }

    set({ collection: newCollection })
    await storageSet('collection', newCollection)
  },

  removeFromCollection: async (scryfallId) => {
    const newCollection = get().collection.filter(c => c.scryfallId !== scryfallId)
    set({ collection: newCollection })
    await storageSet('collection', newCollection)
  },

  updateCardQuantity: async (scryfallId, quantity) => {
    if (quantity <= 0) {
      return get().removeFromCollection(scryfallId)
    }
    const newCollection = get().collection.map(c =>
      c.scryfallId === scryfallId ? { ...c, quantity } : c
    )
    set({ collection: newCollection })
    await storageSet('collection', newCollection)
  },

  isInCollection: (scryfallId) => {
    return get().collection.some(c => c.scryfallId === scryfallId)
  },

  getCollectionCard: (scryfallId) => {
    return get().collection.find(c => c.scryfallId === scryfallId)
  },

  createDeck: async (name, format, description) => {
    const newDeck: Deck = {
      id: crypto.randomUUID(),
      name,
      format,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cards: []
    }
    const newDecks = [...get().decks, newDeck]
    set({ decks: newDecks })
    await storageSet('decks', newDecks)
    return newDeck
  },

  deleteDeck: async (deckId) => {
    const newDecks = get().decks.filter(d => d.id !== deckId)
    set({ decks: newDecks })
    await storageSet('decks', newDecks)
  },

  updateDeck: async (deckId, updates) => {
    const newDecks = get().decks.map(d =>
      d.id === deckId ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
    )
    set({ decks: newDecks })
    await storageSet('decks', newDecks)
  },

  addCardToDeck: async (deckId, card) => {
    const decks = get().decks
    const deck = decks.find(d => d.id === deckId)
    if (!deck) return

    const existingCard = deck.cards.find(c => c.scryfallId === card.scryfallId && c.board === card.board)
    let newCards: DeckCard[]

    if (existingCard) {
      newCards = deck.cards.map(c =>
        c.scryfallId === card.scryfallId && c.board === card.board
          ? { ...c, quantity: c.quantity + card.quantity }
          : c
      )
    } else {
      newCards = [...deck.cards, card]
    }

    const newDecks = decks.map(d =>
      d.id === deckId ? { ...d, cards: newCards, updatedAt: new Date().toISOString() } : d
    )
    set({ decks: newDecks })
    await storageSet('decks', newDecks)
  },

  removeCardFromDeck: async (deckId, scryfallId, board) => {
    const decks = get().decks
    const newDecks = decks.map(d =>
      d.id === deckId
        ? {
            ...d,
            cards: d.cards.filter(c => !(c.scryfallId === scryfallId && c.board === board)),
            updatedAt: new Date().toISOString()
          }
        : d
    )
    set({ decks: newDecks })
    await storageSet('decks', newDecks)
  },

  updateDeckCardQuantity: async (deckId, scryfallId, board, quantity) => {
    if (quantity <= 0) {
      return get().removeCardFromDeck(deckId, scryfallId, board)
    }
    const decks = get().decks
    const newDecks = decks.map(d =>
      d.id === deckId
        ? {
            ...d,
            cards: d.cards.map(c =>
              c.scryfallId === scryfallId && c.board === board ? { ...c, quantity } : c
            ),
            updatedAt: new Date().toISOString()
          }
        : d
    )
    set({ decks: newDecks })
    await storageSet('decks', newDecks)
  },

  getDeck: (deckId) => {
    return get().decks.find(d => d.id === deckId)
  }
}))

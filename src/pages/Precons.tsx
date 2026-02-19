import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getDeckList,
  getDeck,
  MTGJSONDeckMeta,
  PRECON_DECK_TYPES
} from '@/lib/mtgjson'
import {
  getCard,
  getCardsByCollection,
  ScryfallCard,
  getCardImageUri
} from '@/lib/scryfall'
import { useStore } from '@/store/useStore'
import { CardGrid } from '@/components/CardGrid'
import { CardModal } from '@/components/CardModal'
import { AddToDeckModal } from '@/components/AddToDeckModal'
import { SearchBar } from '@/components/SearchBar'
import { CardImage } from '@/components/CardImage'

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

// ─── Deck Detail Modal ────────────────────────────────────────────────────────

function DeckDetailModal({ deck, onClose }: { deck: MTGJSONDeckMeta; onClose: () => void }) {
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null)
  const [addToDeckCard, setAddToDeckCard] = useState<ScryfallCard | null>(null)
  const [addingAll, setAddingAll] = useState(false)
  const [allAdded, setAllAdded] = useState(false)
  const [creatingDeck, setCreatingDeck] = useState(false)
  const [deckCreated, setDeckCreated] = useState(false)

  const addToCollection = useStore(s => s.addToCollection)
  const isInCollection = useStore(s => s.isInCollection)
  const createDeck = useStore(s => s.createDeck)
  const addCardToDeck = useStore(s => s.addCardToDeck)
  const queryClient = useQueryClient()

  // Single query: fetch MTGJSON deck (reusing PreconDeckCard cache) then batch-fetch Scryfall cards.
  // Using one query avoids the React Query v5 closure/dependent-query timing issue.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['deck-full', deck.fileName],
    queryFn: async () => {
      // fetchQuery reuses the ['mtgjson-deck', deck.fileName] cache populated by PreconDeckCard
      const deckData = await queryClient.fetchQuery({
        queryKey: ['mtgjson-deck', deck.fileName],
        queryFn: () => getDeck(deck.fileName),
        staleTime: 1000 * 60 * 60
      })
      const allCards = [...deckData.commander, ...deckData.mainBoard]
      const ids = allCards.map(c => c.identifiers.scryfallId).filter(Boolean) as string[]
      const scryfallCards: ScryfallCard[] = []
      for (const batch of chunks(ids, 75)) {
        const cards = await getCardsByCollection(batch.map(id => ({ id })))
        scryfallCards.push(...cards)
      }
      return { deckData, scryfallCards }
    },
    staleTime: 1000 * 60 * 30
  })

  const deckData = data?.deckData
  const scryfallCards = data?.scryfallCards

  const totalCards = useMemo(() => {
    if (!deckData) return 0
    return [...deckData.commander, ...deckData.mainBoard].reduce((s, c) => s + c.count, 0)
  }, [deckData])

  const handleAddAllToCollection = async () => {
    if (!scryfallCards || !deckData) return
    setAddingAll(true)
    const countMap = new Map<string, number>()
    for (const c of [...deckData.commander, ...deckData.mainBoard]) {
      countMap.set(c.name, (countMap.get(c.name) || 0) + c.count)
    }
    for (const card of scryfallCards) {
      await addToCollection({
        scryfallId: card.id,
        name: card.name,
        set: card.set,
        setName: card.set_name,
        quantity: countMap.get(card.name) || 1,
        foil: false,
        condition: 'NM',
        imageUri: getCardImageUri(card, 'normal'),
        manaCost: card.mana_cost,
        typeLine: card.type_line,
        colors: card.colors || card.color_identity || []
      })
    }
    setAddingAll(false)
    setAllAdded(true)
    setTimeout(() => setAllAdded(false), 3000)
  }

  const handleAddAsDeck = async () => {
    if (!scryfallCards || !deckData) return
    setCreatingDeck(true)
    const countMap = new Map<string, number>()
    const commanderNames = new Set(deckData.commander.map(c => c.name))
    for (const c of [...deckData.commander, ...deckData.mainBoard]) {
      countMap.set(c.name, (countMap.get(c.name) || 0) + c.count)
    }
    const newDeck = await createDeck(deck.name, 'commander', `Preconstruido: ${deck.name}`)
    for (const card of scryfallCards) {
      const imageUri = getCardImageUri(card, 'normal')
      await addCardToDeck(newDeck.id, {
        scryfallId: card.id,
        name: card.name,
        quantity: countMap.get(card.name) || 1,
        board: commanderNames.has(card.name) ? 'commander' : 'main',
        imageUri,
        manaCost: card.mana_cost,
        typeLine: card.type_line,
        colors: card.colors || card.color_identity
      })
      if (!isInCollection(card.id)) {
        await addToCollection({
          scryfallId: card.id,
          name: card.name,
          set: card.set,
          setName: card.set_name,
          quantity: countMap.get(card.name) || 1,
          foil: false,
          condition: 'NM',
          imageUri,
          manaCost: card.mana_cost,
          typeLine: card.type_line,
          colors: card.colors || card.color_identity || []
        })
      }
    }
    setCreatingDeck(false)
    setDeckCreated(true)
    setTimeout(() => setDeckCreated(false), 3000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-magic-bg border border-magic-card rounded-xl shadow-2xl w-full max-w-5xl mx-4 h-[90vh] flex flex-col">
        <div className="flex-shrink-0 p-5 border-b border-magic-card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-white font-bold text-lg truncate">{deck.name}</h2>
              <p className="text-magic-text text-sm">
                {totalCards} cartas · {deck.code.toUpperCase()}
                {deck.releaseDate && ` · ${new Date(deck.releaseDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleAddAllToCollection} disabled={addingAll || isLoading || !scryfallCards}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  allAdded ? 'bg-green-600 text-white' : addingAll ? 'bg-magic-card text-magic-text animate-pulse' : 'bg-magic-accent hover:bg-magic-accent/80 text-white disabled:opacity-40'
                }`}>
                {allAdded ? '✓ Anadidas' : addingAll ? 'Anadiendo...' : '+ Coleccion'}
              </button>
              <button onClick={handleAddAsDeck} disabled={creatingDeck || isLoading || !scryfallCards}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  deckCreated ? 'bg-green-600 text-white' : creatingDeck ? 'bg-magic-card text-magic-text animate-pulse' : 'bg-magic-blue hover:bg-magic-blue/80 text-white disabled:opacity-40'
                }`}>
                {deckCreated ? '✓ Mazo creado' : creatingDeck ? 'Creando...' : '📚 Crear mazo'}
              </button>
              <button onClick={onClose} className="text-magic-text hover:text-white text-xl ml-1">✕</button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex items-center justify-center py-20 text-magic-text animate-pulse">Cargando cartas...</div>
          )}
          {isError && (
            <div className="flex items-center justify-center py-20 text-red-400 text-sm">
              Error al cargar las cartas. Comprueba tu conexion a internet.
            </div>
          )}
          {!isLoading && !isError && scryfallCards && (
            <CardGrid cards={scryfallCards} onCardClick={setSelectedCard} showQuantity />
          )}
        </div>
      </div>

      <CardModal card={selectedCard} onClose={() => setSelectedCard(null)}
        onAddToDeck={card => { setSelectedCard(null); setAddToDeckCard(card) }} />
      <AddToDeckModal card={addToDeckCard} onClose={() => setAddToDeckCard(null)} />
    </div>
  )
}

// ─── Single precon deck card ──────────────────────────────────────────────────

function PreconDeckCard({ deck, onClick }: { deck: MTGJSONDeckMeta; onClick: () => void }) {
  // Load deck data from MTGJSON to get the commander's scryfallId
  const { data: deckData, isLoading: deckLoading } = useQuery({
    queryKey: ['mtgjson-deck', deck.fileName],
    queryFn: () => getDeck(deck.fileName),
    staleTime: 1000 * 60 * 60
  })

  const commanderScryfallId = deckData?.commander[0]?.identifiers.scryfallId

  // Fetch commander card image from Scryfall
  const { data: commanderCard, isLoading: cardLoading } = useQuery({
    queryKey: ['scryfall-card', commanderScryfallId],
    queryFn: () => getCard(commanderScryfallId!),
    enabled: !!commanderScryfallId,
    staleTime: 1000 * 60 * 30
  })

  const isLoading = deckLoading || cardLoading
  const imageUri = commanderCard ? getCardImageUri(commanderCard, 'normal') : ''

  return (
    <button
      onClick={onClick}
      className="group flex flex-col bg-magic-card hover:bg-magic-blue/20 border border-magic-card/60 hover:border-magic-accent rounded-xl overflow-hidden transition-all text-left w-full"
    >
      <div className="aspect-[5/7] w-full relative">
        {isLoading ? (
          <div className="w-full h-full bg-magic-surface animate-pulse" />
        ) : imageUri ? (
          <CardImage src={imageUri} alt={commanderCard?.name ?? deck.name} className="w-full h-full" />
        ) : (
          <div className="w-full h-full bg-magic-surface flex items-center justify-center">
            <span className="text-3xl">📚</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-t-xl" />
      </div>
      <div className="p-2 space-y-0.5">
        <p className="text-white text-xs font-semibold leading-tight line-clamp-2 group-hover:text-magic-accent transition-colors">
          {deck.name}
        </p>
        {commanderCard && (
          <p className="text-magic-text text-[10px] opacity-70 truncate">{commanderCard.name}</p>
        )}
        {deck.releaseDate && (
          <p className="text-magic-text text-[10px] opacity-40">
            {new Date(deck.releaseDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })}
          </p>
        )}
      </div>
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Precons() {
  const [search, setSearch] = useState('')
  const [searchActive, setSearchActive] = useState('')
  const [selectedDeck, setSelectedDeck] = useState<MTGJSONDeckMeta | null>(null)

  const { data: decks, isLoading, isError } = useQuery({
    queryKey: ['mtgjson-deck-list'],
    queryFn: async () => {
      const list = await getDeckList()
      return list
        .filter(d => PRECON_DECK_TYPES.includes(d.type))
        .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
    },
    staleTime: 1000 * 60 * 60
  })

  const filtered = useMemo(() => {
    if (!decks) return []
    if (!searchActive) return decks
    const q = searchActive.toLowerCase()
    return decks.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q)
    )
  }, [decks, searchActive])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-magic-card">
        <h2 className="text-white font-bold text-xl mb-4">Mazos Preconstruidos</h2>
        <SearchBar
          value={search}
          onChange={setSearch}
          onSearch={setSearchActive}
          placeholder="Buscar mazo preconstruido..."
        />
        {!isLoading && decks && (
          <p className="text-magic-text text-sm mt-2">
            <span className="text-white font-semibold">{filtered.length}</span> mazos
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-magic-text animate-pulse">
            <div className="text-center">
              <div className="text-4xl mb-3">📦</div>
              <p>Cargando mazos...</p>
            </div>
          </div>
        )}
        {isError && (
          <div className="text-center py-20 text-red-400">
            <p className="text-lg mb-1">Error al cargar los mazos</p>
            <p className="text-sm opacity-60">Comprueba tu conexion a internet</p>
          </div>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="text-center py-20 text-magic-text opacity-60">
            <div className="text-4xl mb-3">🔍</div>
            <p>No se encontraron mazos</p>
          </div>
        )}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {filtered.map(deck => (
              <PreconDeckCard
                key={deck.fileName}
                deck={deck}
                onClick={() => setSelectedDeck(deck)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedDeck && (
        <DeckDetailModal deck={selectedDeck} onClose={() => setSelectedDeck(null)} />
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore, CollectionCard } from '@/store/useStore'
import { CardImage } from '@/components/CardImage'
import { SearchBar } from '@/components/SearchBar'
import { getCard } from '@/lib/scryfall'

const COLOR_OPTIONS = [
  { value: '', label: 'Todos los colores' },
  { value: 'W', label: 'Blanco' },
  { value: 'U', label: 'Azul' },
  { value: 'B', label: 'Negro' },
  { value: 'R', label: 'Rojo' },
  { value: 'G', label: 'Verde' },
  { value: 'C', label: 'Incoloro' }
]

const CONDITION_COLORS: Record<string, string> = {
  M: 'text-blue-400',
  NM: 'text-green-400',
  LP: 'text-yellow-400',
  MP: 'text-orange-400',
  HP: 'text-red-400',
  DMG: 'text-red-600'
}

function CollectionCardItem({
  card,
  onClick,
  onQuantityChange,
  onRemove,
  deckNames = []
}: {
  card: CollectionCard
  onClick: () => void
  onQuantityChange: (qty: number) => void
  onRemove: () => void
  deckNames?: string[]
}) {
  return (
    <div
      className="group bg-magic-surface rounded-lg overflow-hidden border border-magic-card hover:border-magic-accent transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="aspect-[5/7] relative">
        <CardImage src={card.imageUri} alt={card.name} />
        {card.foil && (
          <div className="absolute top-1 left-1 bg-magic-gold text-black text-xs px-1.5 py-0.5 rounded font-bold">
            Foil
          </div>
        )}
        {deckNames.length > 0 ? (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/75 transition-colors flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 p-1 pointer-events-none">
            <p className="text-magic-text text-[10px] mb-1 font-semibold uppercase tracking-wide">En tus mazos:</p>
            {deckNames.slice(0, 4).map(name => (
              <p key={name} className="text-white text-[10px] truncate w-full text-center leading-tight">{name}</p>
            ))}
            {deckNames.length > 4 && <p className="text-magic-text text-[10px]">+{deckNames.length - 4} mas</p>}
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
        )}
      </div>
      <div className="p-2">
        <p className="text-white text-xs font-medium truncate">{card.name}</p>
        <p className="text-magic-text text-xs opacity-60 truncate">{card.setName}</p>
        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs font-medium ${CONDITION_COLORS[card.condition] || 'text-white'}`}>
            {card.condition}
          </span>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onQuantityChange(card.quantity - 1)}
              className="w-5 h-5 bg-magic-card rounded text-white text-xs hover:bg-magic-bg"
            >-</button>
            <span className="text-white text-xs font-bold w-5 text-center">{card.quantity}</span>
            <button
              onClick={() => onQuantityChange(card.quantity + 1)}
              className="w-5 h-5 bg-magic-card rounded text-white text-xs hover:bg-magic-bg"
            >+</button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface CollectionDetailModal {
  card: CollectionCard | null
  onClose: () => void
  onRemove: (scryfallId: string) => void
}

function CollectionDetailModal({ card, onClose, onRemove }: CollectionDetailModal) {
  const { data: scryfallCard } = useQuery({
    queryKey: ['card', card?.scryfallId],
    queryFn: () => getCard(card!.scryfallId),
    enabled: !!card,
    staleTime: 1000 * 60 * 10
  })

  if (!card) return null

  const prices = scryfallCard?.prices
  const hasPrices = prices && (prices.usd || prices.usd_foil || prices.eur || prices.eur_foil)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-magic-surface border border-magic-card rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">{card.name}</h3>
          <button onClick={onClose} className="text-magic-text hover:text-white">✕</button>
        </div>
        <div className="flex gap-4">
          <div className="w-28 flex-shrink-0">
            <div className="aspect-[5/7]">
              <CardImage src={card.imageUri} alt={card.name} />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-magic-text">Set: <span className="text-white">{card.setName}</span></p>
            <p className="text-magic-text">Tipo: <span className="text-white">{card.typeLine}</span></p>
            <p className="text-magic-text">Cantidad: <span className="text-white font-bold">{card.quantity}</span></p>
            <p className="text-magic-text">Condicion: <span className={CONDITION_COLORS[card.condition]}>{card.condition}</span></p>
            <p className="text-magic-text">Foil: <span className="text-white">{card.foil ? 'Si' : 'No'}</span></p>
            <p className="text-magic-text text-xs opacity-60">
              Anadida: {new Date(card.addedAt).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>

        {/* Prices */}
        {hasPrices && (
          <div className="mt-4 bg-magic-card rounded-lg p-3">
            <p className="text-magic-text text-xs font-semibold mb-2">Precios (Scryfall)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {prices.usd && (
                <div className="flex justify-between">
                  <span className="text-magic-text text-xs">USD:</span>
                  <span className="text-white text-xs font-medium">${prices.usd}</span>
                </div>
              )}
              {prices.usd_foil && (
                <div className="flex justify-between">
                  <span className="text-magic-gold text-xs">USD Foil:</span>
                  <span className="text-magic-gold text-xs font-medium">${prices.usd_foil}</span>
                </div>
              )}
              {prices.eur && (
                <div className="flex justify-between">
                  <span className="text-magic-text text-xs">EUR:</span>
                  <span className="text-white text-xs font-medium">€{prices.eur}</span>
                </div>
              )}
              {prices.eur_foil && (
                <div className="flex justify-between">
                  <span className="text-magic-gold text-xs">EUR Foil:</span>
                  <span className="text-magic-gold text-xs font-medium">€{prices.eur_foil}</span>
                </div>
              )}
            </div>
            {card.quantity > 1 && prices.usd && (
              <p className="text-magic-text text-xs mt-2 opacity-60">
                Total coleccion: ${(parseFloat(prices.usd) * card.quantity).toFixed(2)} USD
              </p>
            )}
          </div>
        )}
        {scryfallCard && !hasPrices && (
          <p className="text-magic-text text-xs mt-3 opacity-40 text-center">Sin datos de precio disponibles</p>
        )}

        <button
          onClick={() => { onRemove(card.scryfallId); onClose() }}
          className="mt-4 w-full py-2 bg-red-900/50 hover:bg-red-900 text-red-400 hover:text-white rounded-lg text-sm transition-colors"
        >
          Eliminar de coleccion
        </button>
      </div>
    </div>
  )
}

export function Collection() {
  const collection = useStore(s => s.collection)
  const updateCardQuantity = useStore(s => s.updateCardQuantity)
  const removeFromCollection = useStore(s => s.removeFromCollection)
  const decks = useStore(s => s.decks)

  const cardDeckMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const deck of decks) {
      for (const card of deck.cards) {
        const existing = map.get(card.scryfallId) ?? []
        if (!existing.includes(deck.name)) existing.push(deck.name)
        map.set(card.scryfallId, existing)
      }
    }
    return map
  }, [decks])

  const [search, setSearch] = useState('')
  const [searchActive, setSearchActive] = useState('')
  const [filterColor, setFilterColor] = useState('')
  const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null)

  const filtered = useMemo(() => {
    let cards = [...collection]

    if (searchActive) {
      const q = searchActive.toLowerCase()
      cards = cards.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.setName.toLowerCase().includes(q) ||
        c.typeLine.toLowerCase().includes(q)
      )
    }

    if (filterColor) {
      cards = cards.filter(c => c.colors.includes(filterColor))
    }

    return cards.sort((a, b) => a.name.localeCompare(b.name))
  }, [collection, searchActive, filterColor])

  const totalCards = collection.reduce((sum, c) => sum + c.quantity, 0)
  const totalUnique = collection.length

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-magic-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-xl">Mi Coleccion</h2>
          <div className="text-magic-text text-sm">
            <span className="text-white font-bold">{totalCards}</span> cartas
            <span className="mx-2 opacity-40">|</span>
            <span className="text-white font-bold">{totalUnique}</span> unicas
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              onSearch={setSearchActive}
              placeholder="Filtrar por nombre, set, tipo..."
            />
          </div>
          <select
            value={filterColor}
            onChange={e => setFilterColor(e.target.value)}
            className="bg-magic-card text-white px-3 py-3 rounded-lg border border-magic-card focus:outline-none text-sm"
          >
            {COLOR_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {collection.length === 0 ? (
          <div className="text-center py-20 text-magic-text">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-lg mb-2">Tu coleccion esta vacia</p>
            <p className="text-sm opacity-60">Busca cartas en "Buscar Cartas" y anadilas aqui</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-magic-text opacity-60">
            <p>No se encontraron cartas con ese filtro</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map(card => (
              <CollectionCardItem
                key={`${card.scryfallId}-${card.foil}`}
                card={card}
                onClick={() => setSelectedCard(card)}
                onQuantityChange={qty => updateCardQuantity(card.scryfallId, qty)}
                onRemove={() => removeFromCollection(card.scryfallId)}
                deckNames={cardDeckMap.get(card.scryfallId) ?? []}
              />
            ))}
          </div>
        )}
      </div>

      <CollectionDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onRemove={removeFromCollection}
      />
    </div>
  )
}

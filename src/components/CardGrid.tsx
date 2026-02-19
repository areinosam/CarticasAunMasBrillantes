import { useMemo } from 'react'
import { ScryfallCard, getCardImageUri } from '@/lib/scryfall'
import { CardImage } from './CardImage'
import { useStore } from '@/store/useStore'

interface CardGridProps {
  cards: ScryfallCard[]
  onCardClick: (card: ScryfallCard) => void
  showQuantity?: boolean
  /** When true: grays out not-owned cards and shows deck tooltip on owned cards */
  showCollectionStatus?: boolean
}

export function CardGrid({
  cards,
  onCardClick,
  showQuantity = false,
  showCollectionStatus = false
}: CardGridProps) {
  const isInCollection = useStore(s => s.isInCollection)
  const getCollectionCard = useStore(s => s.getCollectionCard)
  const decks = useStore(s => s.decks)

  // Build a map: scryfallId → deck names (for the hover tooltip)
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

  if (cards.length === 0) {
    return (
      <div className="text-center py-16 text-magic-text opacity-50">
        <div className="text-5xl mb-4">🃏</div>
        <p>No se encontraron cartas</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {cards.map(card => {
        const imageUri = getCardImageUri(card, 'normal')
        const inCollection = isInCollection(card.id)
        const collectionCard = (showQuantity || showCollectionStatus) ? getCollectionCard(card.id) : undefined
        const deckNames = showCollectionStatus ? (cardDeckMap.get(card.id) ?? []) : []
        const notOwned = showCollectionStatus && !inCollection

        return (
          <button
            key={card.id}
            onClick={() => onCardClick(card)}
            className="group relative flex flex-col rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-magic-accent"
            title={card.name}
          >
            <div className="aspect-[5/7] relative">
              {/* Card image — grayscale when not owned in search mode */}
              <div className={notOwned ? 'grayscale opacity-50 w-full h-full' : 'w-full h-full'}>
                <CardImage src={imageUri} alt={card.name} className="w-full h-full" />
              </div>

              {/* Not-owned overlay: no tienes */}
              {notOwned && (
                <div className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none">
                  <span className="bg-black/70 text-magic-text text-[10px] px-1.5 py-0.5 rounded">
                    No tienes
                  </span>
                </div>
              )}

              {/* Collection quantity badge */}
              {inCollection && (
                <div className="absolute top-1 right-1 bg-magic-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow">
                  {collectionCard ? collectionCard.quantity : '✓'}
                </div>
              )}

              {/* Deck membership tooltip (only in search mode, only if owned) */}
              {showCollectionStatus && inCollection && deckNames.length > 0 && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/75 transition-colors flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg p-1">
                  <p className="text-magic-text text-[10px] mb-1 font-semibold uppercase tracking-wide">En tus mazos:</p>
                  {deckNames.slice(0, 4).map(name => (
                    <p key={name} className="text-white text-[10px] truncate w-full text-center leading-tight">{name}</p>
                  ))}
                  {deckNames.length > 4 && (
                    <p className="text-magic-text text-[10px]">+{deckNames.length - 4} mas</p>
                  )}
                </div>
              )}

              {/* Standard hover overlay (when no deck tooltip) */}
              {!(showCollectionStatus && inCollection && deckNames.length > 0) && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
              )}
            </div>

            <div className="bg-magic-surface p-1.5 text-center">
              <p className={`text-xs font-medium truncate ${notOwned ? 'text-magic-text/50' : 'text-white'}`}>
                {card.name}
              </p>
              <p className="text-magic-text text-xs opacity-60 truncate">{card.set_name}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

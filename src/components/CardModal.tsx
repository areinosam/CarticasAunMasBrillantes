import { useState, useEffect, useCallback } from 'react'
import { ScryfallCard, getCardImageUri, getManaCost } from '@/lib/scryfall'
import { CardImage } from './CardImage'
import { useStore } from '@/store/useStore'

interface CardModalProps {
  card: ScryfallCard | null
  onClose: () => void
  onAddToDeck?: (card: ScryfallCard) => void
}

type Condition = 'M' | 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'

const CONDITIONS: Condition[] = ['M', 'NM', 'LP', 'MP', 'HP', 'DMG']
const CONDITION_LABELS: Record<Condition, string> = {
  M: 'Mint',
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged'
}

const COLOR_SYMBOLS: Record<string, string> = {
  W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌿',
  C: '💎', S: '❄️', X: '✖️'
}

function ManaCostDisplay({ manaCost }: { manaCost: string }) {
  if (!manaCost) return null
  // Parse mana symbols like {W}, {U}, {2}, {G/W}, etc.
  const symbols = manaCost.match(/\{[^}]+\}/g) || []
  return (
    <span className="flex items-center gap-0.5 flex-wrap">
      {symbols.map((sym, i) => {
        const inner = sym.replace(/[{}]/g, '')
        const emoji = COLOR_SYMBOLS[inner]
        return (
          <span
            key={i}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-magic-card text-xs font-bold border border-magic-text/20"
            title={inner}
          >
            {emoji || inner}
          </span>
        )
      })}
    </span>
  )
}

export function CardModal({ card, onClose, onAddToDeck }: CardModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [foil, setFoil] = useState(false)
  const [condition, setCondition] = useState<Condition>('NM')
  const [addedFeedback, setAddedFeedback] = useState(false)

  const addToCollection = useStore(s => s.addToCollection)
  const isInCollection = useStore(s => s.isInCollection)
  const getCollectionCard = useStore(s => s.getCollectionCard)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (card) {
      setQuantity(1)
      setFoil(false)
      setCondition('NM')
      setAddedFeedback(false)
    }
  }, [card])

  if (!card) return null

  const imageUri = getCardImageUri(card, 'large')
  const manaCost = getManaCost(card)
  const inCollection = isInCollection(card.id)
  const collectionCard = getCollectionCard(card.id)

  const handleAddToCollection = async () => {
    await addToCollection({
      scryfallId: card.id,
      name: card.name,
      set: card.set,
      setName: card.set_name,
      quantity,
      foil,
      condition,
      imageUri: getCardImageUri(card, 'normal'),
      manaCost: manaCost,
      typeLine: card.type_line,
      colors: card.colors || card.color_identity || []
    })
    setAddedFeedback(true)
    setTimeout(() => setAddedFeedback(false), 2000)
  }

  const formatLegalities = () => {
    const legal = Object.entries(card.legalities || {})
      .filter(([, status]) => status === 'legal')
      .map(([format]) => format)
    return legal.slice(0, 5)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-magic-surface border border-magic-card rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-magic-card">
          <h2 className="text-white font-bold text-lg">{card.name}</h2>
          <button
            onClick={onClose}
            className="text-magic-text hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 p-6">
          {/* Card Image */}
          <div className="flex-shrink-0 w-full md:w-64">
            <div className="aspect-[5/7]">
              <CardImage src={imageUri} alt={card.name} />
            </div>
            {card.prices && (
              <div className="mt-3 bg-magic-card rounded-lg p-3 text-xs">
                <p className="text-magic-text font-semibold mb-1">Precios</p>
                {card.prices.usd && <p className="text-white">USD: ${card.prices.usd}</p>}
                {card.prices.usd_foil && <p className="text-magic-gold">USD Foil: ${card.prices.usd_foil}</p>}
                {card.prices.eur && <p className="text-white">EUR: €{card.prices.eur}</p>}
              </div>
            )}
          </div>

          {/* Card Details */}
          <div className="flex-1 space-y-4">
            {/* Mana cost and type */}
            <div className="space-y-2">
              {manaCost && (
                <div className="flex items-center gap-2">
                  <span className="text-magic-text text-xs w-20">Coste:</span>
                  <ManaCostDisplay manaCost={manaCost} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-magic-text text-xs w-20">Tipo:</span>
                <span className="text-white text-sm">{card.type_line}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-magic-text text-xs w-20">Set:</span>
                <span className="text-white text-sm">{card.set_name} ({card.set.toUpperCase()})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-magic-text text-xs w-20">Rareza:</span>
                <span className={`text-sm font-medium capitalize ${
                  card.rarity === 'mythic' ? 'text-orange-400' :
                  card.rarity === 'rare' ? 'text-yellow-400' :
                  card.rarity === 'uncommon' ? 'text-gray-400' :
                  'text-white'
                }`}>{card.rarity}</span>
              </div>
              {(card.power || card.toughness) && (
                <div className="flex items-center gap-2">
                  <span className="text-magic-text text-xs w-20">P/T:</span>
                  <span className="text-white text-sm font-bold">{card.power}/{card.toughness}</span>
                </div>
              )}
            </div>

            {/* Oracle text */}
            {card.oracle_text && (
              <div className="bg-magic-card rounded-lg p-3">
                <p className="text-magic-text text-xs mb-1 font-semibold">Texto</p>
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{card.oracle_text}</p>
              </div>
            )}

            {/* Legalities */}
            {formatLegalities().length > 0 && (
              <div>
                <p className="text-magic-text text-xs font-semibold mb-2">Legal en:</p>
                <div className="flex flex-wrap gap-1">
                  {formatLegalities().map(format => (
                    <span key={format} className="bg-green-900/50 text-green-400 text-xs px-2 py-0.5 rounded capitalize">
                      {format}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Collection info */}
            {inCollection && collectionCard && (
              <div className="bg-green-900/30 border border-green-800 rounded-lg p-3">
                <p className="text-green-400 text-sm font-semibold">
                  En tu coleccion: {collectionCard.quantity}x ({collectionCard.condition})
                  {collectionCard.foil && ' - Foil'}
                </p>
              </div>
            )}

            {/* Add to Collection */}
            <div className="bg-magic-card rounded-lg p-4 space-y-3">
              <p className="text-white text-sm font-semibold">Anadir a coleccion</p>

              <div className="flex items-center gap-3">
                <label className="text-magic-text text-xs w-20">Cantidad:</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="bg-magic-surface w-7 h-7 rounded text-white hover:bg-magic-bg transition-colors"
                  >-</button>
                  <span className="text-white font-bold w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="bg-magic-surface w-7 h-7 rounded text-white hover:bg-magic-bg transition-colors"
                  >+</button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-magic-text text-xs w-20">Condicion:</label>
                <select
                  value={condition}
                  onChange={e => setCondition(e.target.value as Condition)}
                  className="bg-magic-surface text-white text-xs rounded px-2 py-1 border border-magic-text/20 focus:outline-none"
                >
                  {CONDITIONS.map(c => (
                    <option key={c} value={c}>{c} - {CONDITION_LABELS[c]}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-magic-text text-xs w-20">Foil:</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={foil}
                  onClick={() => setFoil(f => !f)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none ${
                    foil ? 'bg-magic-accent border-transparent' : 'bg-magic-bg border-magic-text/40'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200 ease-in-out ${
                      foil ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                {foil && <span className="text-magic-gold text-xs font-medium">✨ Foil</span>}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAddToCollection}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    addedFeedback
                      ? 'bg-green-600 text-white'
                      : 'bg-magic-accent hover:bg-magic-accent/80 text-white'
                  }`}
                >
                  {addedFeedback ? 'Anadido!' : `Anadir ${quantity}x a Coleccion`}
                </button>
                {onAddToDeck && (
                  <button
                    onClick={() => onAddToDeck(card)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-magic-blue hover:bg-magic-blue/80 text-white transition-colors"
                  >
                    Anadir a Mazo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { ScryfallCard, getCardImageUri } from '@/lib/scryfall'
import { useStore, DeckCard } from '@/store/useStore'

interface AddToDeckModalProps {
  card: ScryfallCard | null
  onClose: () => void
  defaultDeckId?: string
}

export function AddToDeckModal({ card, onClose, defaultDeckId }: AddToDeckModalProps) {
  const [selectedDeckId, setSelectedDeckId] = useState(defaultDeckId ?? '')
  const [board, setBoard] = useState<DeckCard['board']>('main')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const decks = useStore(s => s.decks)
  const addCardToDeck = useStore(s => s.addCardToDeck)
  const addToCollection = useStore(s => s.addToCollection)
  const isInCollection = useStore(s => s.isInCollection)
  const createDeck = useStore(s => s.createDeck)

  // Decks that already contain this card
  const decksWithCard = useMemo(() => {
    if (!card) return []
    return decks.filter(d => d.cards.some(c => c.scryfallId === card.id))
  }, [card, decks])
  const [newDeckName, setNewDeckName] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)

  if (!card) return null

  const handleAdd = async () => {
    if (!selectedDeckId) return
    await addCardToDeck(selectedDeckId, {
      scryfallId: card.id,
      name: card.name,
      quantity,
      board,
      imageUri: getCardImageUri(card, 'normal'),
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
        quantity,
        foil: false,
        condition: 'NM',
        imageUri: getCardImageUri(card, 'normal'),
        manaCost: card.mana_cost,
        typeLine: card.type_line,
        colors: card.colors || card.color_identity
      })
    }
    setAdded(true)
    setTimeout(() => {
      setAdded(false)
      onClose()
    }, 1500)
  }

  const handleCreateAndAdd = async () => {
    if (!newDeckName.trim()) return
    const newDeck = await createDeck(newDeckName.trim(), 'casual')
    setSelectedDeckId(newDeck.id)
    setCreatingNew(false)
    setNewDeckName('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-magic-surface border border-magic-card rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">Anadir a Mazo</h3>
          <button onClick={onClose} className="text-magic-text hover:text-white">✕</button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-16 flex-shrink-0">
            <img
              src={getCardImageUri(card, 'small')}
              alt={card.name}
              className="w-full h-full object-cover rounded"
              onError={e => (e.currentTarget.style.display = 'none')}
            />
          </div>
          <div>
            <p className="text-white font-medium">{card.name}</p>
            <p className="text-magic-text text-sm">{card.set_name}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Deck selection */}
          <div>
            <label className="text-magic-text text-sm block mb-2">Seleccionar mazo:</label>
            {decks.length === 0 ? (
              <p className="text-magic-text text-sm opacity-60">No tienes mazos. Crea uno primero.</p>
            ) : (
              <select
                value={selectedDeckId}
                onChange={e => setSelectedDeckId(e.target.value)}
                className="w-full bg-magic-card text-white rounded-lg px-3 py-2 border border-magic-text/20 focus:outline-none text-sm"
              >
                <option value="">-- Seleccionar mazo --</option>
                {decks.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.format})</option>
                ))}
              </select>
            )}
          </div>

          {decksWithCard.length > 0 && (
            <div className="text-xs bg-magic-card/50 rounded-lg px-3 py-2 text-magic-text">
              <span className="opacity-70">Ya en: </span>
              {decksWithCard.map(d => (
                <span key={d.id} className="text-white font-medium mr-1">{d.name}</span>
              ))}
            </div>
          )}

          {/* Create new deck inline */}
          {creatingNew ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newDeckName}
                onChange={e => setNewDeckName(e.target.value)}
                placeholder="Nombre del mazo"
                className="flex-1 bg-magic-card text-white rounded px-3 py-2 text-sm border border-magic-text/20 focus:outline-none"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreateAndAdd()}
              />
              <button onClick={handleCreateAndAdd} className="bg-magic-accent text-white px-3 py-2 rounded text-sm">
                Crear
              </button>
              <button onClick={() => setCreatingNew(false)} className="text-magic-text px-2">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingNew(true)}
              className="text-magic-accent text-sm hover:underline"
            >
              + Crear nuevo mazo
            </button>
          )}

          {/* Board selection */}
          <div>
            <label className="text-magic-text text-sm block mb-2">Zona:</label>
            <div className="flex gap-2">
              {(['main', 'sideboard', 'commander'] as const).map(b => (
                <button
                  key={b}
                  onClick={() => setBoard(b)}
                  className={`flex-1 py-2 rounded text-xs font-medium transition-colors ${
                    board === b ? 'bg-magic-accent text-white' : 'bg-magic-card text-magic-text hover:text-white'
                  }`}
                >
                  {b === 'main' ? 'Principal' : b === 'sideboard' ? 'Sideboard' : 'Comandante'}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-3">
            <label className="text-magic-text text-sm">Cantidad:</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="bg-magic-card w-7 h-7 rounded text-white">-</button>
              <span className="text-white font-bold w-8 text-center">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="bg-magic-card w-7 h-7 rounded text-white">+</button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!selectedDeckId || added}
            className={`w-full py-3 rounded-lg font-medium text-sm transition-colors ${
              added
                ? 'bg-green-600 text-white'
                : selectedDeckId
                ? 'bg-magic-accent hover:bg-magic-accent/80 text-white'
                : 'bg-magic-card text-magic-text cursor-not-allowed'
            }`}
          >
            {added ? 'Anadido!' : `Anadir ${quantity}x al mazo`}
          </button>
        </div>
      </div>
    </div>
  )
}

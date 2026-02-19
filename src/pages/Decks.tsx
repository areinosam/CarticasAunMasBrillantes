import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { getCardByName, getCardImageUri } from '@/lib/scryfall'

const FORMATS = [
  'standard', 'pioneer', 'modern', 'legacy', 'vintage',
  'commander', 'pauper', 'brawl', 'historic', 'casual'
]

function CreateDeckModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [format, setFormat] = useState('commander')
  const [description, setDescription] = useState('')
  const createDeck = useStore(s => s.createDeck)

  const handleCreate = async () => {
    if (!name.trim()) return
    await createDeck(name.trim(), format, description.trim() || undefined)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-magic-surface border border-magic-card rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold text-lg">Crear Nuevo Mazo</h3>
          <button onClick={onClose} className="text-magic-text hover:text-white">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-magic-text text-sm block mb-1">Nombre del mazo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Mi super mazo..."
              className="w-full bg-magic-card text-white rounded-lg px-4 py-3 border border-magic-text/20 focus:outline-none focus:border-magic-accent text-sm"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div>
            <label className="text-magic-text text-sm block mb-1">Formato</label>
            <select
              value={format}
              onChange={e => setFormat(e.target.value)}
              className="w-full bg-magic-card text-white rounded-lg px-4 py-3 border border-magic-text/20 focus:outline-none capitalize text-sm"
            >
              {FORMATS.map(f => (
                <option key={f} value={f} className="capitalize">{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-magic-text text-sm block mb-1">Descripcion (opcional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descripcion o estrategia del mazo..."
              rows={3}
              className="w-full bg-magic-card text-white rounded-lg px-4 py-3 border border-magic-text/20 focus:outline-none resize-none text-sm"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="w-full py-3 rounded-lg bg-magic-accent hover:bg-magic-accent/80 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Crear Mazo
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Import modal ─────────────────────────────────────────────────────────────

interface ImportProgress { done: number; total: number; current: string; errors: string[] }

function parseDeckList(text: string): Array<{ quantity: number; name: string; board: 'main' | 'commander' | 'sideboard' }> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const cards: Array<{ quantity: number; name: string; board: 'main' | 'commander' | 'sideboard' }> = []
  let currentBoard: 'main' | 'commander' | 'sideboard' = 'main'
  for (const line of lines) {
    if (line.startsWith('//') || line.startsWith('#')) continue
    const lower = line.toLowerCase()
    if (lower === 'commander') { currentBoard = 'commander'; continue }
    if (lower === 'deck' || lower === 'main') { currentBoard = 'main'; continue }
    if (lower === 'sideboard' || lower === 'side') { currentBoard = 'sideboard'; continue }
    const match = line.match(/^(\d+)x?\s+(.+)$/)
    if (match) {
      cards.push({ quantity: parseInt(match[1]), name: match[2].trim(), board: currentBoard })
    } else if (line.length > 0) {
      cards.push({ quantity: 1, name: line, board: currentBoard })
    }
  }
  return cards
}

function ImportDeckModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [format, setFormat] = useState('commander')
  const [deckText, setDeckText] = useState('')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [done, setDone] = useState(false)
  const createDeck = useStore(s => s.createDeck)
  const addCardToDeck = useStore(s => s.addCardToDeck)

  const handleImport = async () => {
    if (!name.trim() || !deckText.trim()) return
    const parsed = parseDeckList(deckText)
    if (parsed.length === 0) return
    // If no commander header was used, treat the first card as commander
    if (!parsed.some(c => c.board === 'commander')) {
      parsed[0] = { ...parsed[0], board: 'commander' }
    }
    setProgress({ done: 0, total: parsed.length, current: '', errors: [] })
    const deck = await createDeck(name.trim(), format)
    const errors: string[] = []
    for (let i = 0; i < parsed.length; i++) {
      const { quantity, name: cardName, board } = parsed[i]
      setProgress({ done: i, total: parsed.length, current: cardName, errors })
      const card = await getCardByName(cardName)
      if (!card) {
        errors.push(cardName)
        continue
      }
      await addCardToDeck(deck.id, {
        scryfallId: card.id,
        name: card.name,
        quantity,
        board,
        imageUri: getCardImageUri(card, 'normal'),
        manaCost: card.mana_cost,
        typeLine: card.type_line,
        colors: card.colors || card.color_identity
      })
    }
    setProgress({ done: parsed.length, total: parsed.length, current: '', errors })
    setDone(true)
  }

  const preview = parseDeckList(deckText)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => e.target === e.currentTarget && !progress && onClose()}>
      <div className="bg-magic-surface border border-magic-card rounded-xl shadow-2xl max-w-lg w-full mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">Importar Mazo</h3>
          <button onClick={onClose} disabled={!!progress && !done} className="text-magic-text hover:text-white text-xl disabled:opacity-40">✕</button>
        </div>

        {!progress ? (
          <div className="space-y-3">
            <div>
              <label className="text-magic-text text-xs block mb-1">Nombre del mazo</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Mi mazo importado..."
                className="w-full bg-magic-card text-white rounded-lg px-3 py-2 border border-magic-text/20 focus:outline-none focus:border-magic-accent text-sm" />
            </div>
            <div>
              <label className="text-magic-text text-xs block mb-1">Formato</label>
              <select value={format} onChange={e => setFormat(e.target.value)}
                className="w-full bg-magic-card text-white rounded-lg px-3 py-2 border border-magic-text/20 focus:outline-none text-sm">
                {['standard','pioneer','modern','legacy','vintage','commander','pauper','casual'].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-magic-text text-xs block mb-1">Lista de cartas</label>
              <textarea value={deckText} onChange={e => setDeckText(e.target.value)}
                placeholder={'Commander\n1 Sol Ring\n\nDeck\n4 Lightning Bolt\n1 Island\n\nSideboard\n2 Negate'}
                rows={10}
                className="w-full bg-magic-card text-white rounded-lg px-3 py-2 border border-magic-text/20 focus:outline-none resize-none font-mono text-xs" />
            </div>
            {preview.length > 0 && (
              <p className="text-magic-text text-xs">{preview.length} cartas detectadas ({preview.reduce((s,c) => s + c.quantity, 0)} total)</p>
            )}
            <button onClick={handleImport} disabled={!name.trim() || preview.length === 0}
              className="w-full py-2.5 rounded-lg bg-magic-accent hover:bg-magic-accent/80 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
              Importar Mazo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-magic-text">{done ? 'Completado' : `Importando: ${progress.current}`}</span>
                <span className="text-white">{progress.done}/{progress.total}</span>
              </div>
              <div className="w-full h-2 bg-magic-card rounded-full overflow-hidden">
                <div className="h-full bg-magic-accent transition-all duration-300 rounded-full"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
            {progress.errors.length > 0 && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
                <p className="text-red-400 text-xs font-semibold mb-1">No encontradas ({progress.errors.length}):</p>
                <p className="text-red-300 text-xs opacity-70 truncate">{progress.errors.slice(0, 5).join(', ')}{progress.errors.length > 5 ? '...' : ''}</p>
              </div>
            )}
            {done && (
              <button onClick={onClose}
                className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors text-sm">
                Listo — Ver mazos
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type DeckSort = 'updated' | 'name' | 'count'

export function Decks() {
  const decks = useStore(s => s.decks)
  const deleteDeck = useStore(s => s.deleteDeck)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<DeckSort>('updated')

  const handleDelete = async (deckId: string) => {
    await deleteDeck(deckId)
    setDeleteConfirm(null)
  }

  const sortedDecks = [...decks].sort((a, b) => {
    if (sortOrder === 'name') return a.name.localeCompare(b.name)
    if (sortOrder === 'count') {
      const ca = a.cards.reduce((s, c) => s + c.quantity, 0)
      const cb = b.cards.reduce((s, c) => s + c.quantity, 0)
      return cb - ca
    }
    return b.updatedAt.localeCompare(a.updatedAt)
  })

  const SORT_LABELS: Record<DeckSort, string> = { updated: 'Reciente', name: 'A–Z', count: 'Tamaño' }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-magic-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-xl">Mis Mazos</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-magic-card hover:bg-magic-blue text-white rounded-lg text-sm font-medium transition-colors"
            >
              Importar
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-magic-accent hover:bg-magic-accent/80 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + Nuevo Mazo
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-magic-text text-xs">Ordenar:</span>
          {(Object.keys(SORT_LABELS) as DeckSort[]).map(s => (
            <button key={s} onClick={() => setSortOrder(s)}
              className={`px-3 py-1 rounded text-xs transition-colors ${sortOrder === s ? 'bg-magic-accent text-white' : 'bg-magic-card text-magic-text hover:text-white'}`}>
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {decks.length === 0 ? (
          <div className="text-center py-20 text-magic-text">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-lg mb-2">No tienes mazos todavia</p>
            <p className="text-sm opacity-60 mb-6">Crea tu primer mazo para empezar</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-magic-accent hover:bg-magic-accent/80 text-white rounded-lg font-medium transition-colors"
            >
              Crear Mazo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedDecks.map(deck => {
              const mainCount = deck.cards
                .filter(c => c.board === 'main')
                .reduce((sum, c) => sum + c.quantity, 0)
              const sideCount = deck.cards
                .filter(c => c.board === 'sideboard')
                .reduce((sum, c) => sum + c.quantity, 0)
              const commanderCount = deck.cards
                .filter(c => c.board === 'commander')
                .reduce((sum, c) => sum + c.quantity, 0)

              return (
                <div key={deck.id} className="bg-magic-surface border border-magic-card rounded-xl overflow-hidden hover:border-magic-accent transition-colors">
                  <Link to={`/decks/${deck.id}`} className="block p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-white font-bold text-lg">{deck.name}</h3>
                        <span className="text-magic-accent text-xs capitalize bg-magic-card px-2 py-0.5 rounded mt-1 inline-block">
                          {deck.format}
                        </span>
                      </div>
                    </div>

                    {deck.description && (
                      <p className="text-magic-text text-sm mb-3 line-clamp-2">{deck.description}</p>
                    )}

                    <div className="flex gap-3 text-xs">
                      {mainCount > 0 && (
                        <div className="text-center">
                          <p className="text-white font-bold">{mainCount}</p>
                          <p className="text-magic-text">Principal</p>
                        </div>
                      )}
                      {sideCount > 0 && (
                        <div className="text-center">
                          <p className="text-white font-bold">{sideCount}</p>
                          <p className="text-magic-text">Sideboard</p>
                        </div>
                      )}
                      {commanderCount > 0 && (
                        <div className="text-center">
                          <p className="text-white font-bold">{commanderCount}</p>
                          <p className="text-magic-text">Comandante</p>
                        </div>
                      )}
                      {deck.cards.length === 0 && (
                        <p className="text-magic-text opacity-60">Mazo vacio</p>
                      )}
                    </div>

                    <p className="text-magic-text text-xs opacity-40 mt-3">
                      Actualizado: {new Date(deck.updatedAt).toLocaleDateString('es-ES')}
                    </p>
                  </Link>

                  <div className="px-5 pb-4 flex gap-2">
                    <Link
                      to={`/decks/${deck.id}`}
                      className="flex-1 py-2 bg-magic-card hover:bg-magic-blue text-white text-xs rounded-lg text-center transition-colors"
                    >
                      Ver Mazo
                    </Link>
                    {deleteConfirm === deck.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(deck.id)}
                          className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-2 bg-magic-card text-magic-text text-xs rounded-lg"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(deck.id)}
                        className="px-3 py-2 bg-magic-card hover:bg-red-900/50 text-magic-text hover:text-red-400 text-xs rounded-lg transition-colors"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && <CreateDeckModal onClose={() => setShowCreate(false)} />}
      {showImport && <ImportDeckModal onClose={() => setShowImport(false)} />}
    </div>
  )
}

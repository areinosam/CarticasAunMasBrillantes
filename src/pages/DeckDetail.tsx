import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore, DeckCard } from '@/store/useStore'
import { CardImage } from '@/components/CardImage'
import { SearchBar } from '@/components/SearchBar'
import { useQuery } from '@tanstack/react-query'
import { searchCards, ScryfallCard, getCardImageUri, getCard, getCardsByCollection } from '@/lib/scryfall'
import { AddToDeckModal } from '@/components/AddToDeckModal'

type BoardTab = 'main' | 'sideboard' | 'commander'
type SortMode = 'name' | 'cmc' | 'price'

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

function computeCmc(manaCost: string | undefined): number {
  if (!manaCost) return 0
  const nums = manaCost.match(/\d+/g)
  const symbols = manaCost.match(/\{[WUBRGCS]\}/gi)
  let cmc = 0
  if (nums) nums.forEach(n => (cmc += parseInt(n)))
  if (symbols) cmc += symbols.length
  return cmc
}

function getTypeGroup(typeLine: string | undefined): string {
  if (!typeLine) return 'Otros'
  const t = typeLine.toLowerCase()
  if (t.includes('land')) return 'Tierras'
  if (t.includes('creature')) return 'Criaturas'
  if (t.includes('planeswalker')) return 'Planeswalkers'
  if (t.includes('instant')) return 'Instantes'
  if (t.includes('sorcery')) return 'Conjuros'
  if (t.includes('artifact')) return 'Artefactos'
  if (t.includes('enchantment')) return 'Encantamientos'
  return 'Otros'
}

const TYPE_GROUP_ORDER = [
  'Criaturas', 'Planeswalkers', 'Instantes', 'Conjuros',
  'Artefactos', 'Encantamientos', 'Otros', 'Tierras'
]

const COLOR_STYLE: Record<string, { bg: string; border?: string; text: string; name: string }> = {
  W: { bg: '#fefce8', border: '#ca8a04', text: '#374151', name: 'Blanco' },
  U: { bg: '#1d4ed8', text: '#ffffff', name: 'Azul' },
  B: { bg: '#1f2937', border: '#4b5563', text: '#9ca3af', name: 'Negro' },
  R: { bg: '#dc2626', text: '#ffffff', name: 'Rojo' },
  G: { bg: '#16a34a', text: '#ffffff', name: 'Verde' },
  C: { bg: '#6b7280', text: '#ffffff', name: 'Incoloro' },
}

function ManaCircle({ color }: { color: string }) {
  const s = COLOR_STYLE[color]
  if (!s) return <span className="text-magic-text text-xs">{color}</span>
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
      style={{ background: s.bg, color: s.text, border: s.border ? `1px solid ${s.border}` : undefined }}>
      {color}
    </div>
  )
}

// ─── Export modal ─────────────────────────────────────────────────────────────

function ExportDeckModal({ deck, onClose }: { deck: { name: string; format: string; cards: DeckCard[] }; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const deckText = useMemo(() => {
    const lines: string[] = []
    const commanders = deck.cards.filter(c => c.board === 'commander')
    const main = deck.cards.filter(c => c.board === 'main')
    const side = deck.cards.filter(c => c.board === 'sideboard')
    if (commanders.length > 0) {
      lines.push('Commander')
      commanders.forEach(c => lines.push(`${c.quantity} ${c.name}`))
      lines.push('')
    }
    if (main.length > 0) {
      lines.push('Deck')
      main.forEach(c => lines.push(`${c.quantity} ${c.name}`))
      lines.push('')
    }
    if (side.length > 0) {
      lines.push('Sideboard')
      side.forEach(c => lines.push(`${c.quantity} ${c.name}`))
    }
    return lines.join('\n').trim()
  }, [deck.cards])

  const handleCopy = () => {
    navigator.clipboard.writeText(deckText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([deckText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-magic-surface border border-magic-card rounded-xl shadow-2xl w-full max-w-lg mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">Exportar mazo</h3>
          <button onClick={onClose} className="text-magic-text hover:text-white text-xl">✕</button>
        </div>
        <textarea
          readOnly
          value={deckText}
          rows={16}
          className="w-full bg-magic-card text-white text-xs rounded-lg px-3 py-2 font-mono border border-magic-text/20 focus:outline-none resize-none"
        />
        <div className="flex gap-2 mt-3">
          <button onClick={handleCopy}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-magic-accent hover:bg-magic-accent/80 text-white'}`}>
            {copied ? '✓ Copiado' : 'Copiar al portapapeles'}
          </button>
          <button onClick={handleDownload}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-magic-card hover:bg-magic-blue text-white transition-colors">
            Descargar .txt
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Floating card image on hover ─────────────────────────────────────────────

function HoverCardImage({ card, x, y }: { card: DeckCard | null; x: number; y: number }) {
  if (!card || !card.imageUri) return null
  const W = 200
  const H = Math.round(W * 7 / 5)
  const left = Math.min(x + 24, window.innerWidth - W - 16)
  const top = Math.max(8, Math.min(y - H / 2, window.innerHeight - H - 8))
  return (
    <div className="fixed z-50 pointer-events-none" style={{ left, top }}>
      <img src={card.imageUri} alt={card.name}
        className="rounded-xl shadow-2xl border border-magic-card"
        style={{ width: W }} />
    </div>
  )
}

// ─── Text-list deck column ────────────────────────────────────────────────────

function DeckListColumn({
  title, cards, priceMap, onCardClick, onCardHover
}: {
  title: string
  cards: DeckCard[]
  priceMap: Map<string, ScryfallCard> | undefined
  onCardClick: (card: DeckCard) => void
  onCardHover: (card: DeckCard | null) => void
}) {
  const total = cards.reduce((s, c) => s + c.quantity, 0)
  if (cards.length === 0) return null

  const colPrice = priceMap
    ? cards.reduce((s, c) => s + parseFloat(priceMap.get(c.scryfallId)?.prices?.usd || '0') * c.quantity, 0)
    : 0

  return (
    <div className="flex-1 min-w-[110px]">
      {/* Column header */}
      <div className="flex items-baseline gap-1 mb-1 pb-1 border-b border-magic-card">
        <span className="text-magic-text text-xs font-semibold truncate">{title}</span>
        <span className="text-white text-xs font-bold ml-auto flex-shrink-0">{total}</span>
      </div>
      {colPrice > 0 && (
        <p className="text-green-400 text-[10px] mb-1">${colPrice.toFixed(2)}</p>
      )}
      {/* Card rows */}
      <div className="space-y-px">
        {cards.map(card => {
          const price = priceMap?.get(card.scryfallId)?.prices?.usd
          return (
            <div
              key={card.scryfallId}
              className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-magic-card cursor-pointer group"
              onMouseEnter={() => onCardHover(card)}
              onMouseLeave={() => onCardHover(null)}
              onClick={() => onCardClick(card)}
            >
              {card.quantity > 1 && (
                <span className="text-magic-accent text-[11px] font-bold w-5 flex-shrink-0 text-right">
                  {card.quantity}x
                </span>
              )}
              <span className="text-white text-xs truncate group-hover:text-magic-accent transition-colors flex-1">
                {card.name}
              </span>
              {price && (
                <span className="text-green-400 text-[10px] flex-shrink-0 opacity-70 group-hover:opacity-100">
                  ${price}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Card detail modal ────────────────────────────────────────────────────────

function DeckCardDetailModal({ card, deckId, onClose }: { card: DeckCard | null; deckId: string; onClose: () => void }) {
  const removeCardFromDeck = useStore(s => s.removeCardFromDeck)
  const getCollectionCard = useStore(s => s.getCollectionCard)
  const isInCollection = useStore(s => s.isInCollection)
  const updateDeckCardQuantity = useStore(s => s.updateDeckCardQuantity)

  const { data: scryfallCard } = useQuery({
    queryKey: ['card', card?.scryfallId],
    queryFn: () => getCard(card!.scryfallId),
    enabled: !!card,
    staleTime: 1000 * 60 * 10
  })

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!card) return null

  const collectionCard = getCollectionCard(card.scryfallId)
  const inCollection = isInCollection(card.scryfallId)
  const prices = scryfallCard?.prices
  const hasPrices = prices && (prices.usd || prices.usd_foil || prices.eur)
  const boardLabel = card.board === 'main' ? 'Principal' : card.board === 'sideboard' ? 'Sideboard' : 'Comandante'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-magic-surface border border-magic-card rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">{card.name}</h3>
          <button onClick={onClose} className="text-magic-text hover:text-white text-xl">✕</button>
        </div>
        <div className="flex gap-4">
          <div className="w-28 flex-shrink-0 aspect-[5/7]">
            <CardImage src={card.imageUri} alt={card.name} />
          </div>
          <div className="space-y-2 text-sm flex-1">
            {card.typeLine && <p className="text-magic-text">Tipo: <span className="text-white">{card.typeLine}</span></p>}
            {scryfallCard && <p className="text-magic-text">Set: <span className="text-white">{scryfallCard.set_name}</span></p>}
            <div className="flex items-center gap-2">
              <span className="text-magic-text">Cantidad:</span>
              <button onClick={() => updateDeckCardQuantity(deckId, card.scryfallId, card.board, card.quantity - 1)}
                className="w-6 h-6 bg-magic-card rounded text-white text-xs">-</button>
              <span className="text-white font-bold">{card.quantity}x</span>
              <button onClick={() => updateDeckCardQuantity(deckId, card.scryfallId, card.board, card.quantity + 1)}
                className="w-6 h-6 bg-magic-card rounded text-white text-xs">+</button>
            </div>
            <p className="text-magic-text">Zona: <span className="text-white">{boardLabel}</span></p>
            {inCollection
              ? <p className="text-green-400 text-xs">En coleccion: {collectionCard?.quantity}x{collectionCard?.foil ? ' (Foil)' : ''}</p>
              : <p className="text-yellow-400 text-xs">No tienes esta carta</p>}
          </div>
        </div>
        {scryfallCard?.oracle_text && (
          <div className="mt-4 bg-magic-card rounded-lg p-3">
            <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{scryfallCard.oracle_text}</p>
          </div>
        )}
        {hasPrices && (
          <div className="mt-3 bg-magic-card rounded-lg p-3">
            <p className="text-magic-text text-xs font-semibold mb-1">Precios</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {prices.usd && <div className="flex justify-between"><span className="text-magic-text">USD:</span><span className="text-white">${prices.usd}</span></div>}
              {prices.usd_foil && <div className="flex justify-between"><span className="text-yellow-400">Foil:</span><span className="text-yellow-400">${prices.usd_foil}</span></div>}
              {prices.eur && <div className="flex justify-between"><span className="text-magic-text">EUR:</span><span className="text-white">€{prices.eur}</span></div>}
            </div>
          </div>
        )}
        <button onClick={() => { removeCardFromDeck(deckId, card.scryfallId, card.board); onClose() }}
          className="mt-4 w-full py-2 bg-red-900/50 hover:bg-red-900 text-red-400 hover:text-white rounded-lg text-sm transition-colors">
          Quitar del mazo
        </button>
      </div>
    </div>
  )
}

// ─── Mana curve ───────────────────────────────────────────────────────────────

function ManaCurveChart({ cards }: { cards: DeckCard[] }) {
  const nonLands = cards.filter(c => c.board === 'main' && !c.typeLine?.toLowerCase().includes('land'))
  const cmcCounts: Record<number, number> = {}
  nonLands.forEach(card => {
    const key = Math.min(computeCmc(card.manaCost), 7)
    cmcCounts[key] = (cmcCounts[key] || 0) + card.quantity
  })
  const maxCount = Math.max(...Object.values(cmcCounts), 1)
  return (
    <div className="bg-magic-card rounded-lg p-3">
      <p className="text-magic-text text-xs font-semibold mb-2">Curva de Mana</p>
      <div className="flex items-end gap-0.5 h-16">
        {[0,1,2,3,4,5,6,7].map(cost => {
          const count = cmcCounts[cost] || 0
          return (
            <div key={cost} className="flex-1 flex flex-col items-center gap-0.5">
              <span className="text-white text-[9px]">{count > 0 ? count : ''}</span>
              <div className="w-full bg-magic-accent rounded-sm"
                style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '3px' : '0' }} />
              <span className="text-magic-text text-[9px]">{cost === 7 ? '7+' : cost}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Color distribution ───────────────────────────────────────────────────────

function ColorDistribution({ cards }: { cards: DeckCard[] }) {
  const colorMap: Record<string, number> = {}
  cards.filter(c => c.board === 'main').forEach(card => {
    (card.colors || []).forEach(color => {
      colorMap[color] = (colorMap[color] || 0) + card.quantity
    })
  })
  const entries = Object.entries(colorMap)
  if (entries.length === 0) return null
  const total = Math.max(...Object.values(colorMap))
  return (
    <div className="bg-magic-card rounded-lg p-3">
      <p className="text-magic-text text-xs font-semibold mb-2">Colores</p>
      <div className="space-y-1.5">
        {entries.map(([color, count]) => (
          <div key={color} className="flex items-center gap-1.5 text-xs">
            <ManaCircle color={color} />
            <div className="flex-1 h-1.5 bg-magic-surface rounded-full overflow-hidden">
              <div className="h-full bg-magic-accent rounded-full" style={{ width: `${(count / total) * 100}%` }} />
            </div>
            <span className="text-white w-5 text-right text-[10px]">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DeckDetail() {
  const { deckId } = useParams<{ deckId: string }>()
  const getDeck = useStore(s => s.getDeck)
  const removeCardFromDeck = useStore(s => s.removeCardFromDeck)
  const isInCollection = useStore(s => s.isInCollection)
  const updateDeck = useStore(s => s.updateDeck)

  const [activeBoard, setActiveBoard] = useState<BoardTab>('main')
  const [sortMode, setSortMode] = useState<SortMode>('cmc')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [addToDeckCard, setAddToDeckCard] = useState<ScryfallCard | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null)
  const [hoveredCard, setHoveredCard] = useState<DeckCard | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [showStats, setShowStats] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const deck = deckId ? getDeck(deckId) : undefined

  const allIds = useMemo(() => [...new Set((deck?.cards || []).map(c => c.scryfallId))], [deck?.cards])
  const { data: priceMap } = useQuery({
    queryKey: ['deck-prices', deckId, deck?.updatedAt],
    queryFn: async () => {
      const results: ScryfallCard[] = []
      for (const batch of chunks(allIds, 75)) {
        const cards = await getCardsByCollection(batch.map(id => ({ id })))
        results.push(...cards)
      }
      return new Map(results.map(c => [c.id, c]))
    },
    enabled: allIds.length > 0,
    staleTime: 1000 * 60 * 10
  })

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['deck-search', activeSearch],
    queryFn: () => searchCards(activeSearch),
    enabled: activeSearch.trim().length >= 2
  })

  if (!deck) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-magic-text">
        <p className="text-xl mb-4">Mazo no encontrado</p>
        <Link to="/decks" className="text-magic-accent hover:underline">Volver a Mazos</Link>
      </div>
    )
  }

  const totalMain = deck.cards.filter(c => c.board === 'main').reduce((s, c) => s + c.quantity, 0)
  const totalSide = deck.cards.filter(c => c.board === 'sideboard').reduce((s, c) => s + c.quantity, 0)
  const totalCmd = deck.cards.filter(c => c.board === 'commander').reduce((s, c) => s + c.quantity, 0)
  const cardsMissing = deck.cards.filter(c => !isInCollection(c.scryfallId)).length
  const totalValue = priceMap
    ? deck.cards.reduce((s, c) => s + parseFloat(priceMap.get(c.scryfallId)?.prices?.usd || '0') * c.quantity, 0)
    : 0

  const handleSaveName = async () => {
    if (editName.trim()) await updateDeck(deck.id, { name: editName.trim() })
    setIsEditing(false)
  }

  const boardCards = deck.cards.filter(c => c.board === activeBoard)

  const groupedCards = useMemo(() => {
    const sorted = [...boardCards].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name)
      if (sortMode === 'cmc') return computeCmc(a.manaCost) - computeCmc(b.manaCost)
      if (sortMode === 'price') {
        const pa = parseFloat(priceMap?.get(a.scryfallId)?.prices?.usd || '0')
        const pb = parseFloat(priceMap?.get(b.scryfallId)?.prices?.usd || '0')
        return pb - pa
      }
      return 0
    })
    const groups = new Map<string, DeckCard[]>()
    TYPE_GROUP_ORDER.forEach(g => groups.set(g, []))
    sorted.forEach(card => groups.get(getTypeGroup(card.typeLine))?.push(card))
    return groups
  }, [boardCards, sortMode, priceMap])

  const visibleGroups = TYPE_GROUP_ORDER.filter(g => (groupedCards.get(g)?.length || 0) > 0)

  const SORT_LABELS: Record<SortMode, string> = { name: 'A–Z', cmc: 'Coste', price: 'Precio' }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-magic-card flex items-center gap-3 flex-wrap">
        <Link to="/decks" className="text-magic-text hover:text-white text-sm flex-shrink-0">← Mazos</Link>
        <span className="text-magic-text opacity-40">/</span>
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input value={editName} onChange={e => setEditName(e.target.value)}
              className="bg-magic-card text-white rounded px-3 py-1 text-lg font-bold border border-magic-accent focus:outline-none flex-1 min-w-0"
              autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveName()} />
            <button onClick={handleSaveName} className="text-green-400 text-sm flex-shrink-0">Guardar</button>
            <button onClick={() => setIsEditing(false)} className="text-magic-text text-sm flex-shrink-0">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => { setIsEditing(true); setEditName(deck.name) }}
            className="text-white font-bold text-lg hover:text-magic-accent transition-colors text-left truncate">
            {deck.name}
          </button>
        )}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {totalValue > 0 && <span className="text-green-400 text-sm font-semibold">${totalValue.toFixed(2)}</span>}
          {cardsMissing > 0 && <span className="text-yellow-400 text-xs">{cardsMissing} faltan</span>}
          <span className="text-magic-accent text-xs capitalize bg-magic-card px-2 py-0.5 rounded">{deck.format}</span>
          <button onClick={() => setShowExport(true)}
            className="px-2 py-1 rounded text-xs bg-magic-card text-magic-text hover:text-white transition-colors">
            Exportar
          </button>
          <button onClick={() => setShowStats(s => !s)}
            className={`px-2 py-1 rounded text-xs transition-colors ${showStats ? 'bg-magic-accent text-white' : 'bg-magic-card text-magic-text hover:text-white'}`}>
            Estadisticas
          </button>
        </div>
      </div>

      {/* Board tabs + sort */}
      <div className="flex-shrink-0 px-5 py-2 flex items-center gap-3 flex-wrap border-b border-magic-card">
        <div className="flex gap-1 bg-magic-card rounded-lg p-1">
          {([
            { id: 'main', label: `Principal (${totalMain})` },
            { id: 'sideboard', label: `Side (${totalSide})` },
            { id: 'commander', label: `Cmd (${totalCmd})` }
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveBoard(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeBoard === tab.id ? 'bg-magic-accent text-white' : 'text-magic-text hover:text-white'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-magic-text text-xs">Orden:</span>
          {(Object.keys(SORT_LABELS) as SortMode[]).map(m => (
            <button key={m} onClick={() => setSortMode(m)}
              className={`px-2 py-1 rounded text-xs transition-colors ${sortMode === m ? 'bg-magic-accent text-white' : 'bg-magic-card text-magic-text hover:text-white'}`}>
              {SORT_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats panel (collapsible) */}
      {showStats && (
        <div className="flex-shrink-0 px-5 py-3 border-b border-magic-card flex gap-4 overflow-x-auto">
          <div className="w-52 flex-shrink-0"><ManaCurveChart cards={deck.cards} /></div>
          <div className="w-44 flex-shrink-0"><ColorDistribution cards={deck.cards} /></div>
          <div className="bg-magic-card rounded-lg p-3 text-xs flex-shrink-0 w-40">
            <p className="text-magic-text font-semibold mb-1">Resumen</p>
            <div className="space-y-0.5">
              <div className="flex justify-between"><span className="text-magic-text">Total:</span><span className="text-white font-bold">{totalMain + totalSide + totalCmd}</span></div>
              <div className="flex justify-between"><span className="text-magic-text">Unicas:</span><span className="text-white">{deck.cards.length}</span></div>
              <div className="flex justify-between"><span className="text-magic-text">Formato:</span><span className="text-white capitalize">{deck.format}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Card columns — full width, no scroll */}
      <div className="flex-1 overflow-hidden px-5 py-3">
        {boardCards.length === 0 ? (
          <div className="flex items-center justify-center h-full text-magic-text opacity-60">
            <div className="text-center">
              <p>No hay cartas en esta zona</p>
              <p className="text-sm mt-1">Busca cartas abajo para anadirlas</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-5 h-full overflow-x-auto overflow-y-auto">
            {visibleGroups.map(group => (
              <DeckListColumn
                key={group}
                title={group}
                cards={groupedCards.get(group) || []}
                priceMap={priceMap}
                onCardClick={setSelectedCard}
                onCardHover={setHoveredCard}
              />
            ))}
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="flex-shrink-0 border-t border-magic-card px-5 py-3">
        <SearchBar value={searchQuery} onChange={setSearchQuery} onSearch={setActiveSearch}
          placeholder="Buscar carta para anadir al mazo..." />
        {searchLoading && <p className="text-magic-text text-sm mt-2 animate-pulse">Buscando...</p>}
        {searchResults && searchResults.data.length > 0 && (
          <div className="mt-2 bg-magic-card rounded-lg overflow-hidden max-h-40 overflow-y-auto">
            {searchResults.data.slice(0, 10).map(card => {
              const owned = isInCollection(card.id)
              return (
                <button key={card.id} onClick={() => setAddToDeckCard(card)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-magic-surface text-left transition-colors">
                  <div className={`w-6 h-8 flex-shrink-0 ${!owned ? 'opacity-40 grayscale' : ''}`}>
                    <img src={getCardImageUri(card, 'small')} alt={card.name}
                      className="w-full h-full object-cover rounded"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${owned ? 'text-white' : 'text-magic-text/50'}`}>{card.name}</p>
                    <p className="text-magic-text text-xs opacity-50 truncate">{card.type_line}</p>
                  </div>
                  {owned
                    ? <span className="text-green-400 text-xs flex-shrink-0">✓</span>
                    : <span className="text-magic-text/40 text-xs flex-shrink-0">No tienes</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating card image on hover */}
      <HoverCardImage card={hoveredCard} x={mousePos.x} y={mousePos.y} />

      {showExport && <ExportDeckModal deck={deck} onClose={() => setShowExport(false)} />}
      <DeckCardDetailModal card={selectedCard} deckId={deck.id} onClose={() => setSelectedCard(null)} />
      {addToDeckCard && (
        <AddToDeckModal card={addToDeckCard} onClose={() => setAddToDeckCard(null)} defaultDeckId={deck.id} />
      )}
    </div>
  )
}

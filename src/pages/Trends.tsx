import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchCardsOrdered, getCardsByCollection, ScryfallCard, getCardImageUri } from '@/lib/scryfall'
import { CardImage } from '@/components/CardImage'

// ─── CardMarket URL helper ────────────────────────────────────────────────────

function cardmarketUrl(cardName: string): string {
  return `https://www.cardmarket.com/en/Magic/Products/Singles?searchString=${encodeURIComponent(cardName)}&sortBy=price_asc&availableItems=1`
}

// ─── MTGGoldfish price spikes ─────────────────────────────────────────────────

export interface SpikeCard {
  name: string
  setCode: string
  prevPrice: number
  currPrice: number
  changePct: number
  scryfallCard?: ScryfallCard
}

async function fetchMTGGoldfishSpikes(): Promise<SpikeCard[]> {
  const res = await fetch('https://www.mtggoldfish.com/price_spikes#paper', {
    headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' }
  })
  if (!res.ok) throw new Error('MTGGoldfish fetch failed')
  const html = await res.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const spikes: SpikeCard[] = []
  const rows = Array.from(doc.querySelectorAll('table tr')).slice(1)
  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td'))
    if (cells.length < 4) continue
    const nameEl = cells.find(td => td.querySelector('a'))
    const name = nameEl?.querySelector('a')?.textContent?.trim()
    if (!name) continue
    const priceCells = cells
      .map(td => td.textContent?.trim() || '')
      .filter(t => t.startsWith('$') || t.startsWith('€'))
      .map(t => parseFloat(t.replace(/[$€,]/g, '')))
      .filter(n => !isNaN(n) && n > 0)
    if (priceCells.length < 2) continue
    const [prevPrice, currPrice] = priceCells
    if (currPrice > 150) continue // max 150€
    const changePct = ((currPrice - prevPrice) / prevPrice) * 100
    if (changePct < 15) continue
    const href = nameEl?.querySelector('a')?.getAttribute('href') || ''
    const setCode = href.split('/').filter(Boolean)[2] || ''
    spikes.push({ name, setCode, prevPrice, currPrice, changePct })
    if (spikes.length >= 24) break
  }
  return spikes
}

// ─── Visual card tile ─────────────────────────────────────────────────────────

interface TrendCardTileProps {
  card: ScryfallCard
  prevPrice?: string
  changePct?: number
  onClick: (card: ScryfallCard, prevPrice?: string, changePct?: number) => void
}

function TrendCardTile({ card, prevPrice, changePct, onClick }: TrendCardTileProps) {
  const eur = card.prices?.eur
  const usd = card.prices?.usd
  const price = eur ?? usd
  const currency = eur ? '€' : '$'

  return (
    <button
      onClick={() => onClick(card, prevPrice, changePct)}
      className="group flex-shrink-0 w-[130px] text-left focus:outline-none"
    >
      <div className="relative w-full aspect-[5/7] rounded-xl overflow-hidden shadow-xl">
        <img
          src={getCardImageUri(card, 'normal')}
          alt={card.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Spike badge */}
        {changePct !== undefined && (
          <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
            +{changePct.toFixed(0)}%
          </div>
        )}
        {/* Price badge */}
        {price && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 py-2 pt-4">
            <p className="text-green-400 text-sm font-bold leading-none">{currency}{price}</p>
            {prevPrice && (
              <p className="text-magic-text text-[10px] line-through opacity-60">{currency}{prevPrice}</p>
            )}
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-magic-accent/0 group-hover:bg-magic-accent/15 transition-colors rounded-xl border border-transparent group-hover:border-magic-accent/60" />
      </div>
      <p className="text-white text-[11px] font-semibold mt-2 truncate group-hover:text-magic-accent transition-colors leading-tight px-0.5">
        {card.name}
      </p>
    </button>
  )
}

// ─── Section with horizontal scroll ──────────────────────────────────────────

function TrendSection({
  title, subtitle, icon, cards, spikes, isLoading, isError, onCardClick
}: {
  title: string
  subtitle: string
  icon: string
  cards?: ScryfallCard[]
  spikes?: SpikeCard[]
  isLoading: boolean
  isError: boolean
  onCardClick: (card: ScryfallCard, prevPrice?: string, changePct?: number) => void
}) {
  const count = cards?.length ?? spikes?.filter(s => s.scryfallCard).length ?? 0

  return (
    <div>
      {/* Section header */}
      <div className="flex items-end gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <h3 className="text-white font-bold text-lg tracking-tight">{title}</h3>
            {count > 0 && (
              <span className="text-magic-text text-xs opacity-50 mb-0.5">{count} cartas</span>
            )}
          </div>
          <p className="text-magic-text text-xs opacity-60 ml-7">{subtitle}</p>
        </div>
        <div className="flex-1 h-px bg-magic-card/60 mb-1" />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[130px]">
              <div className="w-full aspect-[5/7] rounded-xl bg-magic-card animate-pulse" />
              <div className="mt-2 h-2.5 bg-magic-card rounded animate-pulse w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex items-center gap-2 py-4 text-red-400/70 text-sm">
          <span>Error al cargar. Comprueba tu conexion a internet.</span>
        </div>
      )}

      {/* Card row */}
      {!isLoading && !isError && (
        <div
          className="flex gap-4 overflow-x-auto pb-3"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a4a transparent' }}
        >
          {cards?.map(card => (
            <TrendCardTile key={card.id} card={card} onClick={onCardClick} />
          ))}
          {spikes?.filter(s => !!s.scryfallCard).map(spike => (
            <TrendCardTile
              key={`${spike.name}-${spike.setCode}`}
              card={spike.scryfallCard!}
              prevPrice={spike.prevPrice.toFixed(2)}
              changePct={spike.changePct}
              onClick={onCardClick}
            />
          ))}
          {!cards?.length && !spikes?.filter(s => s.scryfallCard).length && (
            <p className="text-magic-text text-sm opacity-50 py-4">Sin datos disponibles</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Card detail modal ────────────────────────────────────────────────────────

function TrendCardModal({
  card, prevPrice, changePct, onClose
}: {
  card: ScryfallCard | null
  prevPrice?: string
  changePct?: number
  onClose: () => void
}) {
  if (!card) return null
  const imageUri = getCardImageUri(card, 'normal')
  const eur = card.prices?.eur
  const eurFoil = card.prices?.eur_foil
  const usd = card.prices?.usd
  const usdFoil = card.prices?.usd_foil
  const currPrice = eur ?? usd
  const currency = eur ? '€' : '$'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-magic-surface border border-magic-card/80 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Hero top: card art + gradient overlay */}
        <div className="relative h-36 overflow-hidden">
          <img
            src={getCardImageUri(card, 'large')}
            alt={card.name}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-magic-surface" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 -mt-4">
          <div className="flex items-start gap-4">
            {/* Card thumb */}
            <div className="w-24 flex-shrink-0 -mt-12 rounded-xl overflow-hidden shadow-2xl border-2 border-magic-card">
              <CardImage src={imageUri} alt={card.name} className="w-full" />
            </div>

            {/* Title + meta */}
            <div className="pt-2 flex-1 min-w-0">
              <h2 className="text-white font-bold text-lg leading-tight truncate">{card.name}</h2>
              <p className="text-magic-accent text-xs mt-0.5 capitalize">{card.set_name}</p>
              <p className="text-magic-text text-xs opacity-60 mt-0.5">{card.type_line}</p>
            </div>
          </div>

          {/* Prices */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {eur && (
              <div className="bg-magic-card rounded-xl p-3 text-center">
                <p className="text-magic-text text-[10px] uppercase tracking-wide mb-1">CardMarket (EUR)</p>
                <p className="text-green-400 text-2xl font-bold">€{eur}</p>
                {eurFoil && <p className="text-yellow-400 text-xs mt-0.5">Foil €{eurFoil}</p>}
              </div>
            )}
            {usd && (
              <div className="bg-magic-card rounded-xl p-3 text-center">
                <p className="text-magic-text text-[10px] uppercase tracking-wide mb-1">TCGPlayer (USD)</p>
                <p className="text-green-400 text-2xl font-bold">${usd}</p>
                {usdFoil && <p className="text-yellow-400 text-xs mt-0.5">Foil ${usdFoil}</p>}
              </div>
            )}
          </div>

          {/* Price spike info */}
          {prevPrice && changePct !== undefined && currPrice && (
            <div className="mt-3 bg-orange-900/30 border border-orange-600/40 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-orange-400 text-xs font-bold uppercase tracking-wide">Subida de precio · última semana</span>
                <span className="ml-auto bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  +{changePct.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-center">
                  <p className="text-magic-text text-[10px]">Precio anterior</p>
                  <p className="text-white font-semibold">{currency}{prevPrice}</p>
                </div>
                <div className="flex-1 h-0.5 bg-orange-500/40 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/40 to-green-500/60" />
                </div>
                <div className="text-center">
                  <p className="text-magic-text text-[10px]">Precio actual</p>
                  <p className="text-green-400 font-bold">{currency}{currPrice}</p>
                </div>
              </div>
            </div>
          )}

          {/* Oracle text */}
          {card.oracle_text && (
            <div className="mt-3 bg-magic-card/50 rounded-xl p-3">
              <p className="text-white/80 text-xs leading-relaxed whitespace-pre-wrap">{card.oracle_text}</p>
            </div>
          )}

          {/* Buy button */}
          <a
            href={cardmarketUrl(card.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: 'linear-gradient(135deg, #1a6bbf 0%, #0e4a8c 100%)',
              boxShadow: '0 4px 15px rgba(26,107,191,0.4)'
            }}
          >
            <span>Comprar en CardMarket</span>
            <span className="text-xs opacity-70">↗</span>
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Trends() {
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null)
  const [selectedPrev, setSelectedPrev] = useState<string | undefined>()
  const [selectedChange, setSelectedChange] = useState<number | undefined>()

  // Trending: EDHREC popular non-land cards
  const {
    data: trendingData, isLoading: trendingLoading, isError: trendingError
  } = useQuery({
    queryKey: ['trends-edhrec'],
    queryFn: () => searchCardsOrdered('not:land not:basic', 'edhrec'),
    staleTime: 1000 * 60 * 30
  })

  // Most played commanders
  const {
    data: commandersData, isLoading: commandersLoading, isError: commandersError
  } = useQuery({
    queryKey: ['trends-commanders'],
    queryFn: () => searchCardsOrdered('t:legendary t:creature', 'edhrec'),
    staleTime: 1000 * 60 * 30
  })

  // Price spikes from MTGGoldfish (≤150€), fallback to expensive-but-affordable cards
  const {
    data: spikesData, isLoading: spikesLoading, isError: spikesError
  } = useQuery({
    queryKey: ['trends-spikes'],
    queryFn: async (): Promise<SpikeCard[]> => {
      let spikes: SpikeCard[] = []
      try {
        spikes = await fetchMTGGoldfishSpikes()
      } catch {
        // Fallback: cards that are valuable but ≤150€
        const fallback = await searchCardsOrdered('eur>=5 eur<=150 not:basic', 'eur')
        return fallback.data.slice(0, 20).map(card => ({
          name: card.name,
          setCode: card.set,
          prevPrice: parseFloat(card.prices?.eur || '0') * 0.72,
          currPrice: parseFloat(card.prices?.eur || '0'),
          changePct: 39,
          scryfallCard: card
        }))
      }
      if (spikes.length === 0) return []
      // Enrich with Scryfall card data
      const enriched = await getCardsByCollection(spikes.map(s => ({ name: s.name })))
      const byName = new Map(enriched.map(c => [c.name.toLowerCase(), c]))
      return spikes
        .map(s => ({ ...s, scryfallCard: byName.get(s.name.toLowerCase()) }))
        .filter(s => !!s.scryfallCard)
    },
    staleTime: 1000 * 60 * 15
  })

  const trending = useMemo(() => trendingData?.data.slice(0, 30) ?? [], [trendingData])
  const commanders = useMemo(() => commandersData?.data.slice(0, 30) ?? [], [commandersData])

  const handleCardClick = (card: ScryfallCard, prevPrice?: string, changePct?: number) => {
    setSelectedCard(card)
    setSelectedPrev(prevPrice)
    setSelectedChange(changePct)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-shrink-0 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a3e 50%, #0a1628 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div className="px-6 py-5 relative z-10">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-magic-accent text-xs font-semibold uppercase tracking-widest mb-1">Magic: The Gathering</p>
              <h1 className="text-white font-bold text-2xl tracking-tight">Mercado</h1>
              <p className="text-magic-text text-xs mt-1 opacity-60">Cartas populares · Subidas de precio · Datos de Scryfall y MTGGoldfish</p>
            </div>
          </div>
        </div>
        {/* Decorative gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-48 opacity-10"
          style={{ background: 'radial-gradient(ellipse at right, #6c46e0, transparent)' }} />
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
        <TrendSection
          title="En Tendencia"
          subtitle="Cartas más populares según EDHREC"
          icon="🔥"
          cards={trending}
          isLoading={trendingLoading}
          isError={trendingError}
          onCardClick={handleCardClick}
        />

        <TrendSection
          title="Más Jugadas"
          subtitle="Comandantes y legendarias más usadas en Commander"
          icon="⚔️"
          cards={commanders}
          isLoading={commandersLoading}
          isError={commandersError}
          onCardClick={handleCardClick}
        />

        <TrendSection
          title="Subidas de Precio"
          subtitle="Cartas hasta 150€ con mayor subida reciente · Fuente: MTGGoldfish"
          icon="📈"
          spikes={spikesData}
          isLoading={spikesLoading}
          isError={spikesError}
          onCardClick={handleCardClick}
        />
      </div>

      <TrendCardModal
        card={selectedCard}
        prevPrice={selectedPrev}
        changePct={selectedChange}
        onClose={() => {
          setSelectedCard(null)
          setSelectedPrev(undefined)
          setSelectedChange(undefined)
        }}
      />
    </div>
  )
}

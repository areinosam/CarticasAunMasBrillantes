import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchCards, ScryfallCard, ScryfallSearchResponse } from '@/lib/scryfall'
import { SearchBar } from '@/components/SearchBar'
import { CardGrid } from '@/components/CardGrid'
import { CardModal } from '@/components/CardModal'
import { AddToDeckModal } from '@/components/AddToDeckModal'

export function SearchCards() {
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null)
  const [addToDeckCard, setAddToDeckCard] = useState<ScryfallCard | null>(null)

  const { data, isLoading, isError, error } = useQuery<ScryfallSearchResponse, Error>({
    queryKey: ['search', activeQuery, page],
    queryFn: () => searchCards(activeQuery, page),
    enabled: activeQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 5 // 5 minutes cache
  })

  const handleSearch = useCallback((q: string) => {
    setActiveQuery(q)
    setPage(1)
  }, [])

  const handleCardClick = (card: ScryfallCard) => {
    setSelectedCard(card)
  }

  const handleAddToDeck = (card: ScryfallCard) => {
    setSelectedCard(null)
    setAddToDeckCard(card)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-magic-card">
        <h2 className="text-white font-bold text-xl mb-4">Buscar Cartas</h2>
        <SearchBar
          value={query}
          onChange={setQuery}
          onSearch={handleSearch}
          placeholder="Buscar en Scryfall... (ej: t:creature c:red, s:dom, name:lightning)"
        />
        {activeQuery && data && (
          <p className="text-magic-text text-sm mt-2">
            {data.total_cards.toLocaleString()} cartas encontradas para "{activeQuery}"
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!activeQuery && (
          <div className="text-center py-20 text-magic-text">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-lg mb-2">Busca cartas de Magic</p>
            <p className="text-sm opacity-60 max-w-md mx-auto">
              Usa la sintaxis de Scryfall: <code className="bg-magic-card px-1 rounded">t:creature</code>,{' '}
              <code className="bg-magic-card px-1 rounded">c:blue</code>,{' '}
              <code className="bg-magic-card px-1 rounded">set:dom</code>,{' '}
              <code className="bg-magic-card px-1 rounded">o:flying</code>
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-magic-text animate-pulse text-lg">Buscando...</div>
          </div>
        )}

        {isError && (
          <div className="text-center py-20 text-red-400">
            <p className="text-lg mb-2">Error al buscar</p>
            <p className="text-sm opacity-60">{(error as Error).message}</p>
          </div>
        )}

        {data && !isLoading && (
          <>
            <CardGrid
              cards={data.data}
              onCardClick={handleCardClick}
              showQuantity
              showCollectionStatus
            />

            {/* Pagination */}
            {(page > 1 || data.has_more) && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg bg-magic-card text-white disabled:opacity-40 hover:bg-magic-blue transition-colors"
                >
                  Anterior
                </button>
                <span className="text-magic-text">Pagina {page}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!data.has_more}
                  className="px-4 py-2 rounded-lg bg-magic-card text-white disabled:opacity-40 hover:bg-magic-blue transition-colors"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <CardModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onAddToDeck={handleAddToDeck}
      />

      <AddToDeckModal
        card={addToDeckCard}
        onClose={() => setAddToDeckCard(null)}
      />
    </div>
  )
}

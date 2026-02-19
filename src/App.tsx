import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { Collection } from '@/pages/Collection'
import { SearchCards } from '@/pages/SearchCards'
import { Decks } from '@/pages/Decks'
import { DeckDetail } from '@/pages/DeckDetail'
import { Precons } from '@/pages/Precons'
import { Trends } from '@/pages/Trends'
import { useStore } from '@/store/useStore'

export function App() {
  const initStore = useStore(s => s.initStore)

  useEffect(() => {
    initStore()
  }, [initStore])

  return (
    <div className="flex h-screen bg-magic-bg overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Collection />} />
          <Route path="/search" element={<SearchCards />} />
          <Route path="/decks" element={<Decks />} />
          <Route path="/decks/:deckId" element={<DeckDetail />} />
          <Route path="/precons" element={<Precons />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

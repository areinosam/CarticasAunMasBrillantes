import { useState, useEffect, useRef } from 'react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: (value: string) => void
  placeholder?: string
  debounce?: number
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Buscar cartas... (ej: t:creature c:red)',
  debounce = 300
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalValue(val)
    onChange(val)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (val.trim().length >= 2) {
        onSearch(val.trim())
      }
    }, debounce)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (localValue.trim().length >= 1) {
        onSearch(localValue.trim())
      }
    }
  }

  const handleClear = () => {
    setLocalValue('')
    onChange('')
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-magic-card text-white placeholder-magic-text/50 px-4 py-3 pr-10 rounded-lg border border-magic-card focus:outline-none focus:border-magic-accent transition-colors text-sm"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-magic-text hover:text-white transition-colors"
          aria-label="Limpiar"
        >
          ✕
        </button>
      )}
    </div>
  )
}

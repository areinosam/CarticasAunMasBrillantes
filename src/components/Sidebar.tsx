import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/trends', label: 'Mercado', icon: '📈' },
  { path: '/', label: 'Coleccion', icon: '🃏' },
  { path: '/search', label: 'Buscar Cartas', icon: '🔍' },
  { path: '/decks', label: 'Mazos', icon: '📚' },
  { path: '/precons', label: 'Preconstruidos', icon: '📦' }
]

export function Sidebar() {
  return (
    <nav className="w-56 min-h-screen bg-magic-surface border-r border-magic-card flex flex-col">
      <div className="px-4 py-6 border-b border-magic-card">
        <h1 className="text-magic-gold font-bold text-sm leading-tight">
          Carticas
          <br />
          <span className="text-magic-accent">Aun Mas</span>
          <br />
          Brillantes
        </h1>
        <p className="text-magic-text text-xs mt-1 opacity-60">MTG Collection</p>
      </div>

      <ul className="flex-1 py-4">
        {navItems.map(item => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-magic-card text-white border-r-2 border-magic-accent'
                    : 'text-magic-text hover:bg-magic-card/50 hover:text-white'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="px-4 py-4 border-t border-magic-card text-xs text-magic-text opacity-40">
        Powered by Scryfall
      </div>
    </nav>
  )
}

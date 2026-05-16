import type { Category } from '../../types'

interface CategorySidebarProps {
  categories: Category[]
  selected: string
  onSelect: (slug: string) => void
}

export default function CategorySidebar({ categories, selected, onSelect }: CategorySidebarProps) {
  return (
    <aside className="w-full lg:w-44 shrink-0">
      <p className="text-xs text-c-t3 font-medium uppercase tracking-wider mb-3">Категории</p>
      <ul className="space-y-0.5">
        <li>
          <button
            onClick={() => onSelect('')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 cursor-pointer
              ${selected === '' ? 'bg-c-primary/15 text-c-primary' : 'text-c-t2 hover:text-c-text hover:bg-white/5'}`}
          >
            Все товары
          </button>
        </li>
        {categories.map((cat) => (
          <li key={cat.id}>
            <button
              onClick={() => onSelect(cat.slug)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 cursor-pointer
                ${selected === cat.slug ? 'bg-c-primary/15 text-c-primary' : 'text-c-t2 hover:text-c-text hover:bg-white/5'}`}
            >
              {cat.name}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

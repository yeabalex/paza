import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { CategoryInfo } from '../../api/events';

interface CategoryScrollProps {
  categories: CategoryInfo[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

const MAX_INLINE = 4;

export function CategoryScroll({ categories, activeCategory, onSelectCategory }: CategoryScrollProps) {
  const [isOpen, setIsOpen] = useState(false);

  const inlineCategories = categories.slice(0, MAX_INLINE);
  const overflowCategories = categories.slice(MAX_INLINE);

  return (
    <div className="filter-section">
      {/* Inline quick pills */}
      <div className="filter-inline">
        <button
          type="button"
          className={`pill-btn ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          All
        </button>
        {inlineCategories.map((cat) => (
          <button
            key={cat.slug}
            type="button"
            className={`pill-btn ${activeCategory === cat.slug ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat.slug)}
          >
            {cat.label.split(' & ')[0]}
            {cat.count !== undefined && cat.count > 0 && <span className="pill-count">{cat.count}</span>}
          </button>
        ))}

        {/* Show "More" toggle only if overflow exists */}
        {overflowCategories.length > 0 && (
          <button
            type="button"
            className={`pill-btn pill-more ${isOpen ? 'active' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            <SlidersHorizontal size={13} />
            More
            <ChevronDown size={12} className={isOpen ? 'chevron-flip' : ''} />
          </button>
        )}
      </div>

      {/* Overflow dropdown */}
      {overflowCategories.length > 0 && (
        <div className={`filter-pills-wrap ${isOpen ? 'open' : ''}`}>
          <div className="filter-pills">
            {overflowCategories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                className={`pill-btn ${activeCategory === cat.slug ? 'active' : ''}`}
                onClick={() => { onSelectCategory(cat.slug); setIsOpen(false); }}
              >
                {cat.label}
                {cat.count !== undefined && cat.count > 0 && <span className="pill-count">{cat.count}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

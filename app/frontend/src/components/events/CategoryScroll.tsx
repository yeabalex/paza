import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { CategoryInfo } from '../../api/events';

interface CategoryScrollProps {
  categories: CategoryInfo[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

const MAX_INLINE = 6;

export function CategoryScroll({ categories, activeCategory, onSelectCategory }: CategoryScrollProps) {
  const [isOpen, setIsOpen] = useState(false);

  const inlineCategories = categories.slice(0, MAX_INLINE);
  const overflowCategories = categories.slice(MAX_INLINE);
  const activeOverflowCat = overflowCategories.find((c) => c.slug === activeCategory);

  return (
    <div className="filter-section">
      {/* Inline quick pills */}
      <div className="filter-inline">
        <button
          type="button"
          className={`pill-btn ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          All Events
        </button>

        {inlineCategories.map((cat) => (
          <button
            key={cat.slug}
            type="button"
            className={`pill-btn ${activeCategory === cat.slug ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat.slug)}
          >
            <span>{cat.label.split(' & ')[0]}</span>
            {cat.count !== undefined && cat.count > 0 && (
              <span className="pill-count">{cat.count}</span>
            )}
          </button>
        ))}

        {activeOverflowCat && (
          <button
            type="button"
            className="pill-btn active"
            onClick={() => onSelectCategory(activeOverflowCat.slug)}
          >
            <span>{activeOverflowCat.label.split(' & ')[0]}</span>
            {activeOverflowCat.count !== undefined && activeOverflowCat.count > 0 && (
              <span className="pill-count">{activeOverflowCat.count}</span>
            )}
          </button>
        )}

        {/* Show "More" toggle when overflow categories exist */}
        {overflowCategories.length > 0 && (
          <button
            type="button"
            className={`pill-btn pill-more ${isOpen ? 'active' : ''}`}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
          >
            <SlidersHorizontal size={13} />
            <span>More ({overflowCategories.length})</span>
            <ChevronDown size={12} className={isOpen ? 'chevron-flip' : ''} />
          </button>
        )}
      </div>

      {/* Expandable category grid */}
      {overflowCategories.length > 0 && (
        <div className={`filter-pills-wrap ${isOpen ? 'open' : ''}`}>
          <div className="filter-pills">
            {overflowCategories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                className={`pill-btn ${activeCategory === cat.slug ? 'active' : ''}`}
                onClick={() => {
                  onSelectCategory(cat.slug);
                  setIsOpen(false);
                }}
              >
                <span>{cat.label}</span>
                {cat.count !== undefined && cat.count > 0 && (
                  <span className="pill-count">{cat.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

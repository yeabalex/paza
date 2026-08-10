import { useState } from 'react';
import { Check, Layers, CheckSquare, Square } from 'lucide-react';
import type { Interest } from '../../types';
import { Button } from '../common/Button';

interface InterestSelectorProps {
  interests: Interest[];
  selectedSlugs: string[];
  onToggleInterest: (slug: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  onSave: () => Promise<void>;
}

export function InterestSelector({
  interests,
  selectedSlugs,
  onToggleInterest,
  onSelectAll,
  onClearAll,
  onSave,
}: InterestSelectorProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveClick = async () => {
    if (selectedSlugs.length === 0) return;
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  const allSelected = interests.length > 0 && selectedSlugs.length === interests.length;

  return (
    <div className="app-container" style={{ padding: '24px 20px 40px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Layers size={15} style={{ color: 'var(--accent)' }} />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              color: 'var(--accent)',
            }}
          >
            Multi-Select Categories
          </span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
          Choose Your Interests
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
          Tap multiple categories to customize your personalized Addis Ababa event feed.
        </p>
      </div>

      {/* Selection Control Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Selected: <span style={{ color: 'var(--accent)' }}>{selectedSlugs.length}</span> of {interests.length}
        </span>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={allSelected ? onClearAll : onSelectAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
            }}
          >
            {allSelected ? (
              <>
                <Square size={13} /> Clear All
              </>
            ) : (
              <>
                <CheckSquare size={13} /> Select All
              </>
            )}
          </button>
        </div>
      </div>

      {/* Category Pills Grid - All Categories Visible Upfront */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
        {interests.map((item) => {
          const isSelected = selectedSlugs.includes(item.slug);
          return (
            <button
              key={item.id || item.slug}
              type="button"
              onClick={() => onToggleInterest(item.slug)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '9px 14px',
                borderRadius: 'var(--radius-full)',
                background: isSelected ? 'var(--accent)' : 'var(--bg-surface)',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                color: isSelected ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none',
                fontFamily: 'var(--font-family)',
              }}
            >
              <span>{item.name_en}</span>
              {isSelected && <Check size={14} style={{ color: 'var(--text-on-accent)', strokeWidth: 2.5 }} />}
            </button>
          );
        })}
      </div>

      {/* Bottom Sticky Action Button */}
      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
        <Button
          isLoading={isSaving}
          disabled={selectedSlugs.length === 0}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 'var(--radius-full)',
            fontSize: '14px',
            fontWeight: 600,
            opacity: selectedSlugs.length === 0 ? 0.5 : 1,
            cursor: selectedSlugs.length === 0 ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSaveClick}
        >
          {selectedSlugs.length === 0
            ? 'Select at least 1 category'
            : `Save (${selectedSlugs.length} selected) & Continue`}
        </Button>
      </div>
    </div>
  );
}



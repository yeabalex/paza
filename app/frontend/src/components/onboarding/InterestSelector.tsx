import { useState } from 'react';
import { Check, Layers, CheckSquare, Square, ArrowLeft } from 'lucide-react';
import type { Interest } from '../../types';

interface InterestSelectorProps {
  interests: Interest[];
  selectedSlugs: string[];
  onToggleInterest: (slug: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  onSave: () => Promise<void>;
  onCancel?: () => void;
}

export function InterestSelector({
  interests,
  selectedSlugs,
  onToggleInterest,
  onSelectAll,
  onClearAll,
  onSave,
  onCancel,
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
    <div className="onboarding-shell">
      <div className="onboarding-card">
        {onCancel && (
          <button type="button" className="detail-back-pill" onClick={onCancel} style={{ alignSelf: 'flex-start' }}>
            <ArrowLeft size={15} />
            <span>Back to Feed</span>
          </button>
        )}

        {/* Header */}
        <div className="onboarding-header">
          <div className="discovery-kicker">
            <Layers size={14} />
            <span>Personalize Your Feed</span>
          </div>
          <h1 className="onboarding-title">Choose Your Interests</h1>
          <p className="onboarding-subtitle">
            Select the types of events you want prioritized in your Addis Ababa discovery feed.
          </p>
        </div>

        {/* Selection Control Bar */}
        <div className="onboarding-toolbar">
          <span className="onboarding-count">
            Selected: <strong>{selectedSlugs.length}</strong> of {interests.length}
          </span>
          <button
            type="button"
            className="onboarding-toggle-all"
            onClick={allSelected ? onClearAll : onSelectAll}
          >
            {allSelected ? (
              <>
                <Square size={14} /> Clear All
              </>
            ) : (
              <>
                <CheckSquare size={14} /> Select All
              </>
            )}
          </button>
        </div>

        {/* Category Chips */}
        <div className="onboarding-chips-grid">
          {interests.map((item) => {
            const isSelected = selectedSlugs.includes(item.slug);
            return (
              <button
                key={item.id || item.slug}
                type="button"
                className={`onboarding-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => onToggleInterest(item.slug)}
              >
                <span>{item.name_en}</span>
                {isSelected && <Check size={14} strokeWidth={2.6} />}
              </button>
            );
          })}
        </div>

        {/* Primary Action */}
        <div className="onboarding-footer">
          <button
            type="button"
            className="onboarding-save-btn"
            onClick={handleSaveClick}
            disabled={isSaving || selectedSlugs.length === 0}
          >
            {isSaving ? 'Saving Preferences...' : 'Continue to Events Feed'}
          </button>
        </div>
      </div>
    </div>
  );
}

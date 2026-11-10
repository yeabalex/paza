interface FeedTabsProps {
  activeFeed: 'for-you' | 'explore';
  onSelectFeed: (feed: 'for-you' | 'explore') => void;
}

export function FeedTabs({ activeFeed, onSelectFeed }: FeedTabsProps) {
  return (
    <div className="feed-tabs">
      <button
        type="button"
        className={`feed-tab ${activeFeed === 'for-you' ? 'active' : ''}`}
        onClick={() => onSelectFeed('for-you')}
      >
        For You
        <span className="feed-tab-indicator" />
      </button>
      <button
        type="button"
        className={`feed-tab ${activeFeed === 'explore' ? 'active' : ''}`}
        onClick={() => onSelectFeed('explore')}
      >
        Explore
        <span className="feed-tab-indicator" />
      </button>
    </div>
  );
}

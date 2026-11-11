import { useState, useEffect, useRef, useCallback } from 'react';
import type { UserProfile, Interest, EventItem, User } from './types';
import { fetchInterests, fetchUserProfile, updateUserInterests } from './api/users';
import {
  EXPLORE_PAGE_SIZE,
  fetchExploreEvents,
  fetchCategories,
  saveScrapedEvent,
  removeSavedScrapedEvent,
  fetchSavedScrapedEvents,
  fetchUserRsvps,
  type CategoryInfo,
} from './api/events';

import { TopNav } from './components/common/TopNav';
import { BottomNav } from './components/common/BottomNav';
import { useAppAuth } from './auth/authContext';
import { CategoryScroll } from './components/events/CategoryScroll';
import { SearchBar } from './components/events/SearchBar';
import { ExplorePostCard } from './components/events/ExplorePostCard';
import { InterestSelector } from './components/onboarding/InterestSelector';
import { EventDetail } from './components/events/EventDetail';
import { TicketPassScreen } from './components/events/TicketPassScreen';
import { Calendar, Bookmark, Ticket, LayoutGrid, List, RotateCcw, ShieldAlert } from 'lucide-react';

import './App.css';

const DEFAULT_INTERESTS: Interest[] = [
  { id: '1', slug: 'music', name_en: 'Music & Concerts', name_am: 'ሙዚቃና ኮንሰርት', icon_name: '🎵' },
  { id: '2', slug: 'nightlife', name_en: 'Nightlife & Parties', name_am: 'ምሽት ህይወትና ፓርቲ', icon_name: '🍸' },
  { id: '3', slug: 'tech', name_en: 'Tech & Software', name_am: 'ቴክኖሎጂና ሶፍትዌር', icon_name: '💻' },
  { id: '4', slug: 'business', name_en: 'Business & Entrepreneurship', name_am: 'ቢዝነስና ስራ ፈጠራ', icon_name: '💼' },
  { id: '5', slug: 'art', name_en: 'Arts, Exhibition & Culture', name_am: 'ጥበብና ባህል', icon_name: '🎨' },
  { id: '6', slug: 'food', name_en: 'Food, Coffee & Dining', name_am: 'ምግብና ቡና', icon_name: '☕' },
  { id: '7', slug: 'cinema', name_en: 'Movies, Cinema & Theater', name_am: 'ፊልምና ቴአትር', icon_name: '🍿' },
  { id: '8', slug: 'sports', name_en: 'Sports, Gaming & Esports', name_am: 'ስፖርትና ጌሚንግ', icon_name: '⚽' },
  { id: '9', slug: 'fitness', name_en: 'Fitness, Health & Wellness', name_am: 'ጤናና ፊትንስ', icon_name: '🧘' },
  { id: '10', slug: 'outdoor', name_en: 'Outdoors, Travel & Hiking', name_am: 'የቤት ውጪና ጉዞ', icon_name: '🌲' },
  { id: '11', slug: 'education', name_en: 'Education, Workshops & Training', name_am: 'ትምህርትና ስልጠና', icon_name: '🎓' },
  { id: '12', slug: 'fashion', name_en: 'Fashion, Beauty & Modeling', name_am: 'ፋሽንና ውበት', icon_name: '👗' },
  { id: '13', slug: 'bazaars', name_en: 'Bazaars, Expos & Trade Fairs', name_am: 'ባዛርና ኤግዚቢሽን', icon_name: '🛍️' },
  { id: '14', slug: 'community', name_en: 'Community, Networking & Meetups', name_am: 'ማህበረሰብና ትስስር', icon_name: '🤝' },
  { id: '15', slug: 'charity', name_en: 'Charity, Non-Profit & Social Causes', name_am: 'በጎ አድራጎት', icon_name: '❤️' },
  { id: '16', slug: 'kids', name_en: 'Kids, Family & Youth', name_am: 'ህፃናትና ቤተሰብ', icon_name: '🧸' },
  { id: '17', slug: 'realestate', name_en: 'Real Estate, Architecture & Design', name_am: 'ሪል እስቴትና ዲዛይን', icon_name: '🏢' },
  { id: '18', slug: 'science', name_en: 'Science, Innovation & Research', name_am: 'ሳይንስና ምርምር', icon_name: '🔬' },
  { id: '19', slug: 'books', name_en: 'Books, Literature & Poetry', name_am: 'መጽሐፍትና ግጥም', icon_name: '📚' },
  { id: '20', slug: 'faith', name_en: 'Religious, Spiritual & Faith', name_am: 'ሃይማኖታዊና መንፈሳዊ', icon_name: '🕊️' },
  { id: '21', slug: 'government', name_en: 'Government, Policy & Law', name_am: 'መንግስትና ህግ', icon_name: '🏛️' },
  { id: '22', slug: 'general', name_en: 'Other / General', name_am: 'ሌሎች', icon_name: '✨' },
];

export function App() {
  const { isClerkEnabled, isLoaded: authLoaded, isSignedIn, user: clerkUser, openSignIn } = useAppAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [availableInterests, setAvailableInterests] = useState<Interest[]>(DEFAULT_INTERESTS);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewState, setViewState] = useState<'loading' | 'onboarding' | 'feed' | 'auth_error'>('loading');
  const [authRetryTick, setAuthRetryTick] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<Record<string, boolean>>({});
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [verifyTicketParams, setVerifyTicketParams] = useState<{ eventId: string; ticketCode: string } | null>(null);

  const [timeframe, setTimeframe] = useState<'upcoming' | 'past'>('upcoming');

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!authLoaded || !isClerkEnabled || !isSignedIn || !clerkUser) return;

    const initApp = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const eventIdParam = urlParams.get('event_id');
        const verifyEventId = urlParams.get('verify_event_id') || eventIdParam;
        const ticketCodeParam = urlParams.get('ticket_code');

        if (verifyEventId && ticketCodeParam) {
          setVerifyTicketParams({ eventId: verifyEventId, ticketCode: ticketCodeParam });
        }

        const displayName = clerkUser.fullName || clerkUser.firstName || clerkUser.username || 'User';
        const displayUsername = clerkUser.username || undefined;
        const hasOnboardedLocally = localStorage.getItem(`onboarding_completed_${clerkUser.id}`) === 'true';

        let savedLocalSlugs: string[] = [];
        try {
          const raw = localStorage.getItem(`selected_interests_${clerkUser.id}`);
          if (raw) savedLocalSlugs = JSON.parse(raw);
        } catch (e) {
          console.error('Error parsing local interests', e);
        }

        if (savedLocalSlugs.length > 0) {
          setSelectedSlugs(savedLocalSlugs);
        }

        const [fetchedInterests, profile] = await Promise.all([
          fetchInterests().catch(() => [] as Interest[]),
          fetchUserProfile(clerkUser.id, displayUsername, displayName).catch(() => null),
        ]);

        if (fetchedInterests && fetchedInterests.length > 0) {
          setAvailableInterests(fetchedInterests);
        }

        if (profile) {
          setUser(profile);
          setCurrentUser({
            id: profile.telegram_id ?? 0,
            first_name: profile.full_name || displayName,
            username: profile.username || displayUsername,
            photo_url: clerkUser.imageUrl || undefined,
          });
          const dbSlugs = profile.interests ? profile.interests.map((i) => i.slug) : [];
          const effectiveSlugs = dbSlugs.length > 0 ? dbSlugs : savedLocalSlugs;
          if (effectiveSlugs.length > 0) {
            setSelectedSlugs(effectiveSlugs);
          }

          if (effectiveSlugs.length > 0 || hasOnboardedLocally) {
            setViewState('feed');
          } else {
            setViewState('onboarding');
          }
        } else {
          setUser(null);
          setCurrentUser(null);
          setViewState('auth_error');
        }
      } catch (err) {
        console.error('Error initializing authenticated session:', err);
        setViewState('auth_error');
      }
    };

    initApp();
  }, [authLoaded, isClerkEnabled, isSignedIn, clerkUser, authRetryTick]);

  // Load first page when feed/category/activeTab changes (strictly requires signed-in session)
  useEffect(() => {
    const loadFirstPage = async () => {
      setIsLoadingEvents(true);
      setHasMore(true);
      setSelectedEvent(null);

      fetchCategories().then((cats) => {
        if (cats && cats.length > 0) {
          setCategories(cats);
        }
      });

      if (activeTab === 'saved') {
        if (!user?.telegram_id) {
          setEvents([]);
          setHasMore(false);
          setIsLoadingEvents(false);
          return;
        }
        const savedEvts = await fetchSavedScrapedEvents(user.telegram_id);
        setEvents(savedEvts);
        setHasMore(false);
      } else if (activeTab === 'tickets') {
        if (!user?.telegram_id) {
          setEvents([]);
          setHasMore(false);
          setIsLoadingEvents(false);
          return;
        }
        const rsvpEvts = await fetchUserRsvps(user.telegram_id);
        setEvents(rsvpEvts);
        setHasMore(false);
      } else {
        const initialEvents = await fetchExploreEvents(activeCategory, 0, timeframe);
        setEvents(initialEvents);
        setHasMore(initialEvents.length >= EXPLORE_PAGE_SIZE);
      }
      setIsLoadingEvents(false);
    };

    if (viewState === 'feed' && isClerkEnabled && isSignedIn && clerkUser && user) {
      loadFirstPage();
    }
  }, [activeCategory, activeTab, timeframe, viewState, isClerkEnabled, isSignedIn, clerkUser, user]);

  const loadNextPage = useCallback(async () => {
    if (isLoadingMore || !hasMore || activeTab !== 'home') return;
    setIsLoadingMore(true);
    const newEvents = await fetchExploreEvents(activeCategory, events.length, timeframe);
    if (newEvents.length < EXPLORE_PAGE_SIZE) {
      setHasMore(false);
    }
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const filtered = newEvents.filter((e) => !existingIds.has(e.id));
      return [...prev, ...filtered];
    });
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, activeTab, activeCategory, events.length, timeframe]);

  // Infinite scroll observer
  useEffect(() => {
    if (activeTab !== 'home' || !hasMore || isLoadingMore || isLoadingEvents) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, isLoadingMore, isLoadingEvents, activeTab, loadNextPage]);

  const toggleInterest = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSelectAllInterests = () => {
    setSelectedSlugs(availableInterests.map((i) => i.slug));
  };

  const handleClearAllInterests = () => {
    setSelectedSlugs([]);
  };

  const handleSaveInterests = async () => {
    if (!isSignedIn || !clerkUser || !user?.telegram_id) {
      if (isClerkEnabled) openSignIn();
      return;
    }
    await updateUserInterests(user.telegram_id, selectedSlugs);

    localStorage.setItem(`onboarding_completed_${clerkUser.id}`, 'true');
    localStorage.setItem(`selected_interests_${clerkUser.id}`, JSON.stringify(selectedSlugs));

    setViewState('feed');
  };

  const toggleJoin = (eventId: string) => {
    if (!isSignedIn || !user?.telegram_id) {
      if (isClerkEnabled) openSignIn();
      return;
    }
    const targetEvent = events.find((e) => e.id === eventId);
    const userId = user.telegram_id;

    setJoinedEvents((prev) => {
      const isJoined = !prev[eventId];

      if (targetEvent) {
        if (isJoined) {
          saveScrapedEvent(userId, targetEvent);
        } else {
          removeSavedScrapedEvent(userId, eventId);
        }
      }

      return { ...prev, [eventId]: isJoined };
    });
  };

  const handleSelectTab = (tab: string) => {
    setSelectedEvent(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBrandClick = () => {
    setSelectedEvent(null);
    setActiveTab('home');
    setSearchQuery('');
    setActiveCategory('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEvents = events.filter((ev) => {
    if (!normalizedQuery) return true;
    return (
      ev.title.toLowerCase().includes(normalizedQuery) ||
      (ev.venue_name || '').toLowerCase().includes(normalizedQuery) ||
      (ev.sub_city || '').toLowerCase().includes(normalizedQuery) ||
      (ev.category || '').toLowerCase().includes(normalizedQuery) ||
      (ev.description || '').toLowerCase().includes(normalizedQuery)
    );
  });

  // Child of <RequireAuth>, so clerkUser is guaranteed when mounted
  if (verifyTicketParams) {
    return (
      <TicketPassScreen
        eventId={verifyTicketParams.eventId}
        ticketCode={verifyTicketParams.ticketCode}
        onClose={() => setVerifyTicketParams(null)}
      />
    );
  }

  if (viewState === 'loading') {
    return (
      <div className="loading-screen">
        <img src="/logo.png" alt="PAZA Events" className="loading-logo" />
        <div className="loading-wordmark">PAZA EVENTS</div>
        <div className="loading-dots">
          <div className="dot-loader" />
          <div className="dot-loader" style={{ animationDelay: '0.15s' }} />
          <div className="dot-loader" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    );
  }

  if (viewState === 'auth_error') {
    return (
      <div className="app-shell">
        <TopNav activeTab={activeTab} onSelectTab={handleSelectTab} onBrandClick={handleBrandClick} />
        <div className="auth-error-shell">
          <div className="empty-state-card">
            <div className="empty-state-icon">
              <ShieldAlert size={28} />
            </div>
            <h3>Session Verification Failed</h3>
            <p>
              We couldn&apos;t verify your session with the PAZA backend server. Ensure the backend
              is running with matching Clerk keys and try again.
            </p>
            <button
              type="button"
              className="empty-primary-btn"
              onClick={() => {
                setViewState('loading');
                setAuthRetryTick((n) => n + 1);
              }}
            >
              <RotateCcw size={14} />
              <span>Retry Verification</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'onboarding') {
    const canCancel = Boolean(
      clerkUser && localStorage.getItem(`onboarding_completed_${clerkUser.id}`) === 'true'
    );
    return (
      <InterestSelector
        interests={availableInterests}
        selectedSlugs={selectedSlugs}
        onToggleInterest={toggleInterest}
        onSelectAll={handleSelectAllInterests}
        onClearAll={handleClearAllInterests}
        onSave={handleSaveInterests}
        onCancel={canCancel ? () => setViewState('feed') : undefined}
      />
    );
  }

  const hasActiveFilters = activeTab === 'home' && (activeCategory !== 'all' || searchQuery.trim().length > 0);

  return (
    <div className="app-shell">
      <TopNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onBrandClick={handleBrandClick}
        showInterestsBtn={Boolean(isSignedIn)}
        onOpenInterests={() => setViewState('onboarding')}
      />

      {selectedEvent ? (
        <EventDetail
          event={selectedEvent}
          isJoined={!!joinedEvents[selectedEvent.id]}
          onBack={() => setSelectedEvent(null)}
          onToggleJoin={toggleJoin}
          user={currentUser}
        />
      ) : (
        <div className="page-shell">
          {/* ── Page Header / Discovery Banner ── */}
          {activeTab === 'tickets' ? (
            <section className="page-header-block">
              <div>
                <div className="discovery-kicker">Your Passes</div>
                <h1 className="page-hero-title">My RSVPs</h1>
                <p className="page-hero-subtitle">Events you have confirmed attendance or uploaded tickets for.</p>
              </div>
              <div className="header-stat-pill">
                <span>{events.length} {events.length === 1 ? 'RSVP' : 'RSVPs'}</span>
              </div>
            </section>
          ) : activeTab === 'saved' ? (
            <section className="page-header-block">
              <div>
                <div className="discovery-kicker">Bookmarks</div>
                <h1 className="page-hero-title">Saved Events</h1>
                <p className="page-hero-subtitle">Shortlisted events saved across your sessions.</p>
              </div>
              <div className="header-stat-pill">
                <span>{events.length} saved</span>
              </div>
            </section>
          ) : (
            <section className="page-header-block">
              <div>
                <div className="discovery-kicker">
                  <span className="kicker-dot" />
                  <span>Addis Ababa · Event Discovery</span>
                </div>
                <h1 className="page-hero-title">
                  {timeframe === 'past' ? 'Past Events' : 'Explore Events'}
                </h1>
                <p className="page-hero-subtitle">
                  Concerts, tech meetups, art exhibitions &amp; nightlife happening across Addis Ababa.
                </p>
              </div>

              <div className="timeframe-switch" role="group" aria-label="Event timeframe">
                <button
                  type="button"
                  className={`timeframe-btn ${timeframe === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setTimeframe('upcoming')}
                  aria-pressed={timeframe === 'upcoming'}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  className={`timeframe-btn ${timeframe === 'past' ? 'active' : ''}`}
                  onClick={() => setTimeframe('past')}
                  aria-pressed={timeframe === 'past'}
                >
                  Past
                </button>
              </div>
            </section>
          )}

          {/* ── Filter & Search Toolbar ── */}
          <section className="discovery-controls">
            <div className="controls-top-row">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />

              <div className="controls-right-tools">
                {!isLoadingEvents && (
                  <span className="results-counter">
                    {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
                  </span>
                )}

                <div className="view-mode-toggle" role="group" aria-label="Layout view">
                  <button
                    type="button"
                    className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Card grid view"
                    aria-label="Card grid view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="Compact agenda list"
                    aria-label="Compact agenda list"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>

            {activeTab === 'home' && (
              <CategoryScroll
                categories={categories}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
              />
            )}
          </section>

          {/* ── Event Feed Content ── */}
          <main className="feed-workspace">
            {isLoadingEvents ? (
              viewMode === 'grid' ? (
                <div className="skeleton-feed">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="skeleton-card-box">
                      <div className="skeleton-poster" />
                      <div className="skeleton-card-body">
                        <div className="skeleton-line w-40" />
                        <div className="skeleton-line lg w-85" />
                        <div className="skeleton-line w-60" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="event-feed-list">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-avatar" />
                      <div className="skeleton-lines">
                        <div className="skeleton-line w-85" />
                        <div className="skeleton-line w-40" />
                      </div>
                      <div className="skeleton-btn" />
                    </div>
                  ))}
                </div>
              )
            ) : filteredEvents.length === 0 ? (
              <div className="empty-state-card">
                {activeTab === 'tickets' ? (
                  <>
                    <div className="empty-state-icon">
                      <Ticket size={28} />
                    </div>
                    {isClerkEnabled && !isSignedIn ? (
                      <>
                        <h3>Sign in to view your RSVPs</h3>
                        <p>Your event tickets, payment receipts, and door verification codes stay synced to your account.</p>
                        <button type="button" className="empty-primary-btn" onClick={openSignIn}>
                          Sign In
                        </button>
                      </>
                    ) : (
                      <>
                        <h3>No RSVP'd events yet</h3>
                        <p>Open any event and tap "I'm Going" to keep track of your upcoming plans here.</p>
                        <button type="button" className="empty-secondary-btn" onClick={() => handleSelectTab('home')}>
                          Browse Events
                        </button>
                      </>
                    )}
                  </>
                ) : activeTab === 'saved' ? (
                  <>
                    <div className="empty-state-icon">
                      <Bookmark size={28} />
                    </div>
                    {isClerkEnabled && !isSignedIn ? (
                      <>
                        <h3>Sign in to view saved events</h3>
                        <p>Bookmark concerts, workshops, and meetups so you never lose track of them.</p>
                        <button type="button" className="empty-primary-btn" onClick={openSignIn}>
                          Sign In
                        </button>
                      </>
                    ) : (
                      <>
                        <h3>No saved events yet</h3>
                        <p>Click the bookmark button on any event card to save it to your shortlist.</p>
                        <button type="button" className="empty-secondary-btn" onClick={() => handleSelectTab('home')}>
                          Explore Events
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="empty-state-icon">
                      <Calendar size={28} />
                    </div>
                    <h3>No matching events found</h3>
                    <p>
                      {hasActiveFilters
                        ? 'Try clearing your category filter or adjusting your search keywords.'
                        : 'Check back soon for new Addis Ababa events.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        className="empty-secondary-btn"
                        onClick={() => {
                          setActiveCategory('all');
                          setSearchQuery('');
                        }}
                      >
                        <RotateCcw size={14} />
                        <span>Reset Filters</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'event-feed-grid' : 'event-feed-list'}>
                {filteredEvents.map((ev) => (
                  <ExplorePostCard
                    key={ev.id}
                    event={ev}
                    viewMode={viewMode}
                    isJoined={activeTab === 'saved' || activeTab === 'tickets' ? true : !!joinedEvents[ev.id]}
                    onToggleJoin={toggleJoin}
                    onClick={() => setSelectedEvent(ev)}
                  />
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel & explicit load-more button */}
            {!isLoadingEvents && hasMore && activeTab === 'home' && (
              <div ref={sentinelRef} className="feed-pagination-footer">
                {isLoadingMore ? (
                  <div className="loading-dots">
                    <div className="dot-loader" />
                    <div className="dot-loader" style={{ animationDelay: '0.15s' }} />
                    <div className="dot-loader" style={{ animationDelay: '0.3s' }} />
                  </div>
                ) : (
                  <button type="button" className="load-more-btn" onClick={loadNextPage}>
                    Load more events
                  </button>
                )}
              </div>
            )}

            {!isLoadingEvents && !hasMore && events.length > 0 && (
              <div className="feed-end-note">You've reached the end of the list</div>
            )}
          </main>
        </div>
      )}

      {!selectedEvent && <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />}
    </div>
  );
}

export default App;

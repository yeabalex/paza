import { useState, useEffect, useRef } from 'react';
import type { UserProfile, Interest, EventItem, User } from './types';
import { fetchInterests, fetchUserProfile, updateUserInterests } from './api/users';
import {
  fetchExploreEvents,
  fetchCategories,
  saveScrapedEvent,
  removeSavedScrapedEvent,
  fetchSavedScrapedEvents,
  fetchUserRsvps,
  type CategoryInfo,
} from './api/events';

import { BottomNav } from './components/common/BottomNav';
import { CategoryScroll } from './components/events/CategoryScroll';
import { SearchBar } from './components/events/SearchBar';
import { ExplorePostCard } from './components/events/ExplorePostCard';
import { InterestSelector } from './components/onboarding/InterestSelector';
import { EventDetail } from './components/events/EventDetail';
import { TicketPassScreen } from './components/events/TicketPassScreen';
import { Calendar, Bookmark, Ticket } from 'lucide-react';

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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [availableInterests, setAvailableInterests] = useState<Interest[]>(DEFAULT_INTERESTS);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewState, setViewState] = useState<'loading' | 'onboarding' | 'feed'>('loading');
  const [activeTab, setActiveTab] = useState<string>('home');
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

  // Ref for infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const eventIdParam = urlParams.get('event_id');
        const verifyEventId = urlParams.get('verify_event_id') || eventIdParam;
        const ticketCodeParam = urlParams.get('ticket_code');

        if (verifyEventId && ticketCodeParam) {
          setVerifyTicketParams({ eventId: verifyEventId, ticketCode: ticketCodeParam });
        }

        // Initialize or resolve persistent web user ID
        let storedUserId = localStorage.getItem('paza_user_id');
        if (!storedUserId) {
          storedUserId = String(Math.floor(100000000 + Math.random() * 900000000));
          localStorage.setItem('paza_user_id', storedUserId);
        }
        const numericUserId = parseInt(storedUserId, 10);
        const storedName = localStorage.getItem('paza_user_name') || 'Web User';
        const storedUsername = localStorage.getItem('paza_username') || undefined;

        const webUser: User = {
          id: numericUserId,
          first_name: storedName,
          username: storedUsername,
        };
        setCurrentUser(webUser);

        // Fast-path: Check local storage persistence synchronously for this user
        const hasOnboardedLocally =
          localStorage.getItem(`onboarding_completed_${storedUserId}`) === 'true';

        let savedLocalSlugs: string[] = [];
        try {
          const raw = localStorage.getItem(`selected_interests_${storedUserId}`);
          if (raw) savedLocalSlugs = JSON.parse(raw);
        } catch (e) {
          console.error('Error parsing local interests', e);
        }

        if (savedLocalSlugs.length > 0) {
          setSelectedSlugs(savedLocalSlugs);
        }

        // Returning users land INSTANTLY on feed while profile syncs in background
        if (hasOnboardedLocally || savedLocalSlugs.length > 0) {
          setViewState('feed');
        } else {
          setViewState('loading');
        }

        // Load Interests & Profile concurrently in parallel in background
        const [fetchedInterests, profile] = await Promise.all([
          fetchInterests().catch(() => [] as Interest[]),
          fetchUserProfile(storedUserId, storedUsername, storedName).catch(() => null),
        ]);

        if (fetchedInterests && fetchedInterests.length > 0) {
          setAvailableInterests(fetchedInterests);
        }

        if (profile) {
          setUser(profile);
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
          if (!hasOnboardedLocally && savedLocalSlugs.length === 0) {
            setViewState('onboarding');
          } else {
            setViewState('feed');
          }
        }
      } catch (err) {
        console.error('Error initializing app:', err);
        setViewState('feed');
      }
    };

    initApp();
  }, []);

  // Load first page when feed/category/activeTab changes
  useEffect(() => {
    const loadFirstPage = async () => {
      setIsLoadingEvents(true);
      setHasMore(true);
      setSelectedEvent(null);
      const userId = user?.telegram_id || (currentUser ? currentUser.id : 999888777);

      // Fetch dynamic categories
      fetchCategories().then((cats) => {
        if (cats && cats.length > 0) {
          setCategories(cats);
        }
      });

      if (activeTab === 'saved') {
        const savedEvts = await fetchSavedScrapedEvents(userId);
        setEvents(savedEvts);
        setHasMore(false);
      } else if (activeTab === 'tickets') {
        const rsvpEvts = await fetchUserRsvps(userId);
        setEvents(rsvpEvts);
        setHasMore(false);
      } else {
        const initialEvents = await fetchExploreEvents(activeCategory, 0, timeframe);
        setEvents(initialEvents);
        setHasMore(initialEvents.length >= 15);
      }
      setIsLoadingEvents(false);
    };

    if (viewState === 'feed') {
      loadFirstPage();
    }
  }, [activeCategory, activeTab, timeframe, viewState, user, currentUser]);

  const loadNextPage = async () => {
    if (isLoadingMore || !hasMore || activeTab !== 'home') return;
    setIsLoadingMore(true);
    const nextPage = Math.floor(events.length / 15);
    const newEvents = await fetchExploreEvents(activeCategory, nextPage, timeframe);
    if (newEvents.length < 15) {
      setHasMore(false);
    }
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const filtered = newEvents.filter((e) => !existingIds.has(e.id));
      return [...prev, ...filtered];
    });
    setIsLoadingMore(false);
  };

  // Infinite scroll observer: trigger loadNextPage when sentinel is in view
  useEffect(() => {
    if (activeTab !== 'home' || !hasMore || isLoadingMore || isLoadingEvents) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
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
  }, [hasMore, isLoadingMore, isLoadingEvents, activeTab, events.length, activeCategory, timeframe]);

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
    const userId = user?.telegram_id || (currentUser ? currentUser.id : 999888777);
    await updateUserInterests(userId, selectedSlugs);

    localStorage.setItem(`onboarding_completed_${userId}`, 'true');
    localStorage.setItem(`selected_interests_${userId}`, JSON.stringify(selectedSlugs));

    setViewState('feed');
  };

  const toggleJoin = (eventId: string) => {
    const targetEvent = events.find((e) => e.id === eventId);
    const userId = user?.telegram_id || (currentUser ? currentUser.id : 999888777);

    setJoinedEvents((prev) => {
      const isJoined = !prev[eventId];

      // Persist to PostgreSQL database
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

  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.venue_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
      <div
        className="app-container"
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
          padding: '40px 20px',
          textAlign: 'center',
        }}
      >
        <img
          src="/logo.png"
          alt="PAZA Events"
          style={{
            width: '120px',
            height: '120px',
            objectFit: 'contain',
            background: 'transparent',
            filter: 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.35))',
          }}
        />
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
            PAZA EVENTS
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          <div className="dot-loader" />
          <div className="dot-loader" style={{ animationDelay: '0.15s' }} />
          <div className="dot-loader" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    );
  }

  if (viewState === 'onboarding') {
    return (
      <InterestSelector
        interests={availableInterests}
        selectedSlugs={selectedSlugs}
        onToggleInterest={toggleInterest}
        onSelectAll={handleSelectAllInterests}
        onClearAll={handleClearAllInterests}
        onSave={handleSaveInterests}
      />
    );
  }

  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        isJoined={!!joinedEvents[selectedEvent.id]}
        onBack={() => setSelectedEvent(null)}
        onToggleJoin={toggleJoin}
        telegramUser={currentUser}
      />
    );
  }

  return (
    <div className="app-container">
      {/* ── Conditional Header: Tickets (RSVPs) vs Saved vs Feed ── */}
      {activeTab === 'tickets' ? (
        <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Your RSVPs</h1>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{events.length} joined</span>
        </div>
      ) : activeTab === 'saved' ? (
        <div style={{ padding: '16px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Saved Events</h1>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{events.length} saved</span>
        </div>
      ) : (
        <>
          <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px', margin: 0 }}>
              {timeframe === 'past' ? 'Past Events' : 'Explore Events'}
            </h1>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '20px', padding: '3px', gap: '2px' }}>
              <button
                type="button"
                onClick={() => setTimeframe('upcoming')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: timeframe === 'upcoming' ? 'var(--accent)' : 'transparent',
                  color: timeframe === 'upcoming' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                Upcoming
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('past')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: timeframe === 'past' ? 'var(--accent)' : 'transparent',
                  color: timeframe === 'past' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                Past
              </button>
            </div>
          </div>

          {/* ── Category Scroll Filter Pills (Dynamic categories from Redis) ── */}
          <CategoryScroll
            categories={categories}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
          />
        </>
      )}

      {/* ── Search Bar ── */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* ── Section Title ── */}
      <h2 className="section-title">
        {activeTab === 'tickets' ? 'My Confirmed Events' : activeTab === 'saved' ? 'Your Bookmarks' : 'Events'}
      </h2>

      {/* ── Event Feed ── */}
      <main className="event-feed">
        {isLoadingEvents ? (
          <div className="skeleton-feed">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-avatar" style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)' }} />
                <div className="skeleton-lines" style={{ flex: 1 }}>
                  <div className="skeleton-line w-75" />
                  <div className="skeleton-line w-40" />
                </div>
                <div className="skeleton-btn" />
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          activeTab === 'tickets' ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
              <Ticket size={40} style={{ margin: '0 auto 12px', opacity: 0.4, color: 'var(--accent)' }} />
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No RSVP'd events yet</p>
              <p style={{ fontSize: '13px' }}>Tap "Going" on any event to register your RSVP here.</p>
            </div>
          ) : activeTab === 'saved' ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
              <Bookmark size={40} style={{ margin: '0 auto 12px', opacity: 0.4, color: 'var(--accent)' }} />
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No saved events yet</p>
              <p style={{ fontSize: '13px' }}>Tap the bookmark icon on any event to save it here.</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
              <Calendar size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: '14px' }}>No events found{activeCategory !== 'all' ? ' for this category' : ''}.</p>
            </div>
          )
        ) : (
          filteredEvents.map((ev) => (
            <ExplorePostCard
              key={ev.id}
              event={ev}
              isJoined={activeTab === 'saved' || activeTab === 'tickets' ? true : !!joinedEvents[ev.id]}
              onToggleJoin={toggleJoin}
              onClick={() => setSelectedEvent(ev)}
            />
          ))
        )}

        {/* Infinite scroll sentinel */}
        {!isLoadingEvents && hasMore && activeTab === 'home' && (
          <div ref={sentinelRef} style={{ padding: '20px', textAlign: 'center' }}>
            {isLoadingMore && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                <div className="dot-loader" />
                <div className="dot-loader" style={{ animationDelay: '0.15s' }} />
                <div className="dot-loader" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
          </div>
        )}

        {!isLoadingEvents && !hasMore && events.length > 0 && (
          <div style={{ textAlign: 'center', padding: '16px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
            You've seen all events
          </div>
        )}
      </main>

      {/* ── Bottom Navigation ── */}
      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  );
}

export default App;

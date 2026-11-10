import { Home, Ticket, Heart } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tickets', label: 'RSVPs', icon: Ticket },
  { id: 'saved', label: 'Saved', icon: Heart },
];

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`nav-item ${activeTab === id ? 'active' : ''}`}
          onClick={() => onSelectTab(id)}
        >
          <Icon size={20} />
          <span className="nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}

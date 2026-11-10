import {
  Music,
  GlassWater,
  Utensils,
  Palette,
  Laptop,
  Film,
  Dumbbell,
  Trees,
  Sparkles
} from 'lucide-react';

export const getCategoryIcon = (slug: string) => {
  switch (slug.toLowerCase()) {
    case 'music':
      return <Music className="w-4 h-4" style={{ color: '#ff8c42' }} />;
    case 'nightlife':
      return <GlassWater className="w-4 h-4" style={{ color: '#c084fc' }} />;
    case 'food':
      return <Utensils className="w-4 h-4" style={{ color: '#fbbf24' }} />;
    case 'art':
      return <Palette className="w-4 h-4" style={{ color: '#f472b6' }} />;
    case 'tech':
      return <Laptop className="w-4 h-4" style={{ color: '#60a5fa' }} />;
    case 'cinema':
      return <Film className="w-4 h-4" style={{ color: '#f87171' }} />;
    case 'sports':
      return <Dumbbell className="w-4 h-4" style={{ color: '#34d399' }} />;
    case 'outdoor':
      return <Trees className="w-4 h-4" style={{ color: '#4ade80' }} />;
    default:
      return <Sparkles className="w-4 h-4" style={{ color: '#ff6b35' }} />;
  }
};

import { ThemeOption } from './types';

export const THEMES: ThemeOption[] = [
  {
    id: 'minimal-white',
    name: 'Clean White',
    type: 'solid',
    value: '#ffffff',
    overlayOpacity: 0,
  },
  {
    id: 'diwali-glow',
    name: 'Diwali',
    type: 'gradient',
    // Warm golden glow with subtle radial accents
    value: 'radial-gradient(circle at top right, rgba(255, 180, 0, 0.15), transparent 60%), radial-gradient(circle at bottom left, rgba(255, 80, 0, 0.1), transparent 60%), #fffaf0',
    overlayOpacity: 0,
  },
  {
    id: 'holi-splash',
    name: 'Holi',
    type: 'gradient',
    // Soft pastel splashes
    value: 'radial-gradient(circle at 20% 30%, rgba(236, 72, 153, 0.15) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(34, 211, 238, 0.15) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(250, 204, 21, 0.15) 0%, transparent 40%), #ffffff',
    overlayOpacity: 0,
  },
  {
    id: 'india-pride',
    name: 'India',
    type: 'gradient',
    // Minimal tricolor waves
    value: 'linear-gradient(135deg, rgba(255, 153, 51, 0.12) 0%, transparent 30%, transparent 70%, rgba(19, 136, 8, 0.12) 100%), #ffffff',
    overlayOpacity: 0,
  },
  {
    id: 'christmas-joy',
    name: 'Christmas',
    type: 'gradient',
    // Subtle red/green festive gradient
    value: 'radial-gradient(circle at 0% 0%, rgba(220, 38, 38, 0.08) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(22, 163, 74, 0.08) 0%, transparent 50%), #fff',
    overlayOpacity: 0,
  },
  {
    id: 'vector-geo',
    name: 'Vector',
    type: 'gradient',
    // Abstract geometric modern look
    value: 'linear-gradient(30deg, #f3f4f6 12%, transparent 12.5%, transparent 87%, #f3f4f6 87.5%, #f3f4f6), linear-gradient(150deg, #f3f4f6 12%, transparent 12.5%, transparent 87%, #f3f4f6 87.5%, #f3f4f6), linear-gradient(30deg, #f3f4f6 12%, transparent 12.5%, transparent 87%, #f3f4f6 87.5%, #f3f4f6), linear-gradient(150deg, #f3f4f6 12%, transparent 12.5%, transparent 87%, #f3f4f6 87.5%, #f3f4f6), #ffffff',
    overlayOpacity: 0,
  },
  {
    id: 'delhi-vibes',
    name: 'Delhi Vibes',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1587474262715-9aa032fa4985?q=80&w=600&auto=format&fit=crop',
    overlayOpacity: 0.88,
  },
  {
    id: 'chai-time',
    name: 'Chai Time',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1596443686812-2f45229eebc3?q=80&w=600&auto=format&fit=crop',
    overlayOpacity: 0.88,
  },
  {
    id: 'abstract-neon',
    name: 'Neon Dusk',
    type: 'gradient',
    value: 'radial-gradient(circle at top right, #4f46e5, #000000)',
    overlayOpacity: 0.7,
  }
];

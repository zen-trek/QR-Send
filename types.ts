export interface QRData {
  id: string;
  rawValue: string;
  createdAt: number;
  label?: string;
  amount?: string;
  themeId?: string;
  customBackground?: string; // New field for user uploaded background
  deletedAt?: number;
  isPinned?: boolean;
}

export interface ExpenseRecord {
  id: string;
  amount: number;
  timestamp: number;
  label?: string;
}

export type ThemeOption = {
  id: string;
  name: string;
  type: 'image' | 'gradient' | 'solid';
  value: string;
  overlayOpacity: number;
};

export type ViewState = 'home' | 'editor' | 'gallery' | 'cropper' | 'camera' | 'settings' | 'recycleBin';
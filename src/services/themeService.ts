export type ThemeId =
  | 'fluent-blue'
  | 'midnight-dark'
  | 'emerald-mint'
  | 'royal-purple'
  | 'sunset-amber'
  | 'rose-gold'
  | 'slate-minimal'
  | 'ocean-breeze'
  | 'cyber-matrix'
  | string;

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  category: 'Light' | 'Dark';
  primary: string;
  headerBg: string;
  headerText: string;
  accent: string;
  appBg: string;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  mutedText: string;
  inputBg: string;
  inputBorder: string;
  isDark: boolean;
  previewColors: string[];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'fluent-blue',
    name: 'Fluent Windows Blue (Default)',
    description: 'Crisp, professional Windows 11 Fluent Blue with clean contrast',
    category: 'Light',
    primary: '#0078D4',
    headerBg: '#005A9E',
    headerText: '#FFFFFF',
    accent: '#0078D4',
    appBg: '#F1F5F9',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    textColor: '#1E293B',
    mutedText: '#64748B',
    inputBg: '#FFFFFF',
    inputBorder: '#CBD5E1',
    isDark: false,
    previewColors: ['#005A9E', '#0078D4', '#F1F5F9', '#FFFFFF']
  },
  {
    id: 'midnight-dark',
    name: 'Midnight Cyber Dark',
    description: 'Sleek OLED dark mode with electric blue and emerald glowing accents',
    category: 'Dark',
    primary: '#3B82F6',
    headerBg: '#0B0F19',
    headerText: '#FFFFFF',
    accent: '#60A5FA',
    appBg: '#070A10',
    cardBg: '#111827',
    cardBorder: '#1F2937',
    textColor: '#F3F4F6',
    mutedText: '#9CA3AF',
    inputBg: '#1F2937',
    inputBorder: '#374151',
    isDark: true,
    previewColors: ['#0B0F19', '#111827', '#3B82F6', '#10B981']
  },
  {
    id: 'emerald-mint',
    name: 'Luxury Emerald & Mint',
    description: 'Prestigious botanical green palette for retail, organics & supermarkets',
    category: 'Light',
    primary: '#059669',
    headerBg: '#064E3B',
    headerText: '#FFFFFF',
    accent: '#10B981',
    appBg: '#F0FDF4',
    cardBg: '#FFFFFF',
    cardBorder: '#DCFCE7',
    textColor: '#064E3B',
    mutedText: '#047857',
    inputBg: '#FFFFFF',
    inputBorder: '#A7F3D0',
    isDark: false,
    previewColors: ['#064E3B', '#059669', '#10B981', '#F0FDF4']
  },
  {
    id: 'royal-purple',
    name: 'Royal Velvet & Violet',
    description: 'High-end boutique and jewelry styling with deep purple gradients',
    category: 'Light',
    primary: '#7C3AED',
    headerBg: '#3B0764',
    headerText: '#FFFFFF',
    accent: '#8B5CF6',
    appBg: '#FAF5FF',
    cardBg: '#FFFFFF',
    cardBorder: '#F3E8FF',
    textColor: '#3B0764',
    mutedText: '#6D28D9',
    inputBg: '#FFFFFF',
    inputBorder: '#E9D5FF',
    isDark: false,
    previewColors: ['#3B0764', '#7C3AED', '#A855F7', '#FAF5FF']
  },
  {
    id: 'sunset-amber',
    name: 'Warm Sunset & Terracotta',
    description: 'Energetic warm tones suited for restaurants, cafes, bakeries & food stores',
    category: 'Light',
    primary: '#EA580C',
    headerBg: '#7C2D12',
    headerText: '#FFFFFF',
    accent: '#F97316',
    appBg: '#FFF7ED',
    cardBg: '#FFFFFF',
    cardBorder: '#FFEDD5',
    textColor: '#431407',
    mutedText: '#9A3412',
    inputBg: '#FFFFFF',
    inputBorder: '#FED7AA',
    isDark: false,
    previewColors: ['#7C2D12', '#EA580C', '#F97316', '#FFF7ED']
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold & Blush Fashion',
    description: 'Chic, elegant pastel luxury for fashion apparel and cosmetics',
    category: 'Light',
    primary: '#E11D48',
    headerBg: '#4C0519',
    headerText: '#FFFFFF',
    accent: '#F43F5E',
    appBg: '#FFF1F2',
    cardBg: '#FFFFFF',
    cardBorder: '#FFE4E6',
    textColor: '#4C0519',
    mutedText: '#BE123C',
    inputBg: '#FFFFFF',
    inputBorder: '#FECDD3',
    isDark: false,
    previewColors: ['#4C0519', '#E11D48', '#FB7185', '#FFF1F2']
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze & Caribbean Teal',
    description: 'Calm, refreshing deep turquoise and sea blue palette',
    category: 'Light',
    primary: '#0891B2',
    headerBg: '#155E75',
    headerText: '#FFFFFF',
    accent: '#06B6D4',
    appBg: '#ECFEFF',
    cardBg: '#FFFFFF',
    cardBorder: '#CFFAFE',
    textColor: '#164E63',
    mutedText: '#0E7490',
    inputBg: '#FFFFFF',
    inputBorder: '#A5F3FC',
    isDark: false,
    previewColors: ['#155E75', '#0891B2', '#22D3EE', '#ECFEFF']
  },
  {
    id: 'cyber-matrix',
    name: 'Cyberpunk Neon Matrix',
    description: 'Dark futuristic interface with high-voltage neon green accents',
    category: 'Dark',
    primary: '#10B981',
    headerBg: '#022C22',
    headerText: '#34D399',
    accent: '#34D399',
    appBg: '#05130E',
    cardBg: '#0B1E17',
    cardBorder: '#133E2F',
    textColor: '#ECFDF5',
    mutedText: '#6EE7B7',
    inputBg: '#09231B',
    inputBorder: '#1E5240',
    isDark: true,
    previewColors: ['#022C22', '#05130E', '#10B981', '#34D399']
  },
  {
    id: 'slate-minimal',
    name: 'Titanium Slate Minimalist',
    description: 'Monochrome, understated executive titanium grayscale',
    category: 'Light',
    primary: '#334155',
    headerBg: '#1E293B',
    headerText: '#F8FAFC',
    accent: '#475569',
    appBg: '#F8FAFC',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    textColor: '#0F172A',
    mutedText: '#64748B',
    inputBg: '#FFFFFF',
    inputBorder: '#CBD5E1',
    isDark: false,
    previewColors: ['#1E293B', '#475569', '#94A3B8', '#F8FAFC']
  }
];

export function getTheme(themeId?: string): ThemeDefinition {
  if (!themeId) return THEMES[0];
  const normalized = themeId.toLowerCase();
  if (normalized === 'light') return THEMES[0];
  if (normalized === 'dark') return THEMES[1];
  const found = THEMES.find((t) => t.id === themeId || t.name.toLowerCase().includes(normalized));
  return found || THEMES[0];
}

export function applyThemeToDocument(theme: ThemeDefinition): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-header-bg', theme.headerBg);
  root.style.setProperty('--theme-header-text', theme.headerText);
  root.style.setProperty('--theme-accent', theme.accent);
  root.style.setProperty('--theme-app-bg', theme.appBg);
  root.style.setProperty('--theme-card-bg', theme.cardBg);
  root.style.setProperty('--theme-card-border', theme.cardBorder);
  root.style.setProperty('--theme-text', theme.textColor);
  root.style.setProperty('--theme-muted', theme.mutedText);
  root.style.setProperty('--theme-input-bg', theme.inputBg);
  root.style.setProperty('--theme-input-border', theme.inputBorder);

  if (theme.isDark) {
    root.classList.add('dark');
    document.body.classList.add('dark-theme');
  } else {
    root.classList.remove('dark');
    document.body.classList.remove('dark-theme');
  }
}

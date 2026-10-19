export const RESOURCE_TYPES = ['course', 'book', 'software'];

export const TYPE_META = {
  course: {
    labelKey: 'type.course',
    singularKey: 'type.course',
    icon: 'PlayCircle',
    chip: 'bg-brand-50 text-brand-800 ring-brand-200',
    dot: 'bg-navy-500',
    gradient: 'from-navy-800 via-navy-700 to-navy-500',
    soft: 'from-brand-50 to-brand-100/50'
  },
  book: {
    labelKey: 'type.book',
    singularKey: 'type.book',
    icon: 'BookOpen',
    chip: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
    dot: 'bg-amber-500',
    gradient: 'from-amber-600 via-amber-500 to-orange-400',
    soft: 'from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10'
  },
  software: {
    labelKey: 'type.software',
    singularKey: 'type.software',
    icon: 'AppWindow',
    chip: 'bg-accent-50 text-accent-800 ring-accent-200 dark:bg-accent-500/15 dark:text-accent-200 dark:ring-accent-500/30',
    dot: 'bg-accent-500',
    gradient: 'from-accent-700 via-accent-600 to-accent-400',
    soft: 'from-accent-50 to-accent-100/60 dark:from-accent-500/10 dark:to-accent-500/5'
  }
};

export const CATEGORIES = [
  'Computer Science',
  'Web Development',
  'Data Science',
  'Mathematics',
  'Engineering',
  'Science',
  'Design & Creative',
  'Development Tools',
  'Office & Productivity',
  'Media & Audio',
  'Digital Skills',
  'Business & Career',
  'Study Skills',
  'School & College',
  'Literature',
  'General Learning'
];

export const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];

export const LANGUAGES = ['English', 'Bangla', 'Urdu'];

export const COUNTRIES = ['Bangladesh', 'India', 'Pakistan'];

export const PLATFORMS = ['Windows', 'macOS', 'Linux', 'Android', 'iOS'];

export const REPORT_REASONS = [
  { value: 'copyright', labelKey: 'report.reasons.copyright' },
  { value: 'broken-link', labelKey: 'report.reasons.brokenLink' },
  { value: 'piracy', labelKey: 'report.reasons.piracy' },
  { value: 'inaccurate', labelKey: 'report.reasons.inaccurate' },
  { value: 'spam', labelKey: 'report.reasons.spam' },
  { value: 'other', labelKey: 'report.reasons.other' }
];

export const COUNTRY_FLAGS = {
  Bangladesh: '🇧🇩',
  India: '🇮🇳',
  Pakistan: '🇵🇰'
};

export const SORT_OPTIONS = [
  { value: 'recommended', labelKey: 'filters.sortRecommended' },
  { value: 'newest', labelKey: 'filters.sortNewest' },
  { value: 'az', labelKey: 'filters.sortAZ' }
];

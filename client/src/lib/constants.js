export const RESOURCE_TYPES = ['course', 'book', 'software'];

export const TYPE_META = {
  course: {
    labelKey: 'type.course',
    singularKey: 'type.course',
    icon: 'PlayCircle',
    chip: 'bg-brand-50 text-brand-800 ring-brand-200',
    dot: 'bg-brand-500',
    gradient: 'from-brand-800 via-brand-700 to-brand-500',
    soft: 'from-brand-50 to-brand-100/50'
  },
  book: {
    labelKey: 'type.book',
    singularKey: 'type.book',
    icon: 'BookOpen',
    chip: 'bg-amber-50 text-amber-900 ring-amber-200',
    dot: 'bg-amber-500',
    gradient: 'from-amber-700 via-amber-600 to-orange-400',
    soft: 'from-amber-50 to-orange-50'
  },
  software: {
    labelKey: 'type.software',
    singularKey: 'type.software',
    icon: 'AppWindow',
    chip: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    dot: 'bg-indigo-500',
    gradient: 'from-indigo-900 via-indigo-700 to-violet-500',
    soft: 'from-indigo-50 to-violet-50'
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

export const LANGUAGES = ['English', 'Bangla', 'Hindi', 'Urdu'];

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

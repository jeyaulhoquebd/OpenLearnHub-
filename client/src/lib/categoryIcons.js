import {
  Atom,
  BarChart3,
  BookOpen,
  Briefcase,
  Calculator,
  Camera,
  Code2,
  Cpu,
  FlaskConical,
  Globe2,
  GraduationCap,
  HeartPulse,
  Landmark,
  Languages,
  Leaf,
  Music,
  Palette,
  PenTool,
  Rocket,
  Scale,
  Sigma,
  Terminal,
  Video,
  Wrench
} from 'lucide-react';

/**
 * Curated icon set for categories.
 *
 * Only these names may be stored in `categories/{id}.icon`. The same list
 * lives in `server/config/categoryIcons.js` (the API validates against it) —
 * keep the two files in sync when adding an icon.
 */
export const CATEGORY_ICON_OPTIONS = [
  { name: 'BookOpen', Icon: BookOpen },
  { name: 'Cpu', Icon: Cpu },
  { name: 'Globe2', Icon: Globe2 },
  { name: 'BarChart3', Icon: BarChart3 },
  { name: 'Sigma', Icon: Sigma },
  { name: 'Wrench', Icon: Wrench },
  { name: 'Atom', Icon: Atom },
  { name: 'Palette', Icon: Palette },
  { name: 'Code2', Icon: Code2 },
  { name: 'Terminal', Icon: Terminal },
  { name: 'Briefcase', Icon: Briefcase },
  { name: 'GraduationCap', Icon: GraduationCap },
  { name: 'Languages', Icon: Languages },
  { name: 'Music', Icon: Music },
  { name: 'Video', Icon: Video },
  { name: 'Camera', Icon: Camera },
  { name: 'PenTool', Icon: PenTool },
  { name: 'Calculator', Icon: Calculator },
  { name: 'FlaskConical', Icon: FlaskConical },
  { name: 'Scale', Icon: Scale },
  { name: 'Leaf', Icon: Leaf },
  { name: 'Landmark', Icon: Landmark },
  { name: 'Rocket', Icon: Rocket },
  { name: 'HeartPulse', Icon: HeartPulse }
];

const ICON_MAP = Object.fromEntries(
  CATEGORY_ICON_OPTIONS.map(({ name, Icon }) => [name, Icon])
);

/** Resolves a stored icon name to a component, falling back to BookOpen. */
export function getCategoryIcon(name) {
  return ICON_MAP[name] || BookOpen;
}

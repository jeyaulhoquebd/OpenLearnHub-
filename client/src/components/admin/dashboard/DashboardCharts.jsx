import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { formatNumber } from '../../../lib/utils';

/**
 * Chart primitives for the admin dashboard.
 *
 * Colours come from CSS variables (`rgb(var(--…))`) so axes and grids follow
 * the light/dark theme without re-rendering the chart. Series colours use the
 * navy → purple brand ramp.
 */

const SERIES = {
  users: { stroke: '#4f7cf0', fill: '#7c3aed' },
  resources: { fill: '#7c3aed' }
};

const AXIS_TICK = { fill: 'rgb(var(--ink-muted))', fontSize: 11 };
const GRID_STROKE = 'rgb(var(--sand-200))';

export const TYPE_COLORS = {
  course: '#3b6fe8',
  book: '#f59e0b',
  software: '#7c3aed'
};

export const PROVIDER_COLORS = {
  password: '#2454c4',
  'google.com': '#7c3aed',
  'github.com': '#0d9488',
  'apple.com': '#e11d48',
  other: '#94a3b8'
};

/** "2026-10-20" → "20 Oct" in the active locale. */
export function formatDay(dateKey, locale = 'en') {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    date
  );
}

function compactNumber(value, locale) {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  );
}

function ChartTooltip({ active, payload, label, locale, labelFormatter }) {
  if (!active || !payload?.length) return null;

  const heading = labelFormatter ? labelFormatter(label) : label || payload[0]?.name;

  return (
    <div className="rounded-xl border border-sand-200 bg-surface px-3 py-2 text-xs shadow-soft">
      {heading && <p className="font-semibold text-ink">{heading}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey || entry.name} className="mt-1 flex items-center gap-1.5 text-ink-soft">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color || entry.payload?.fill || '#7c3aed' }}
            aria-hidden="true"
          />
          <span className="font-semibold text-ink">{formatNumber(entry.value, locale)}</span>
        </p>
      ))}
    </div>
  );
}

/** Card chrome shared by every chart. */
export function ChartCard({ title, subtitle, icon: Icon, action, children, className = '' }) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-sand-200 bg-surface p-5 shadow-soft ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />}
            <span className="truncate">{title}</span>
          </h2>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

/**
 * Smooth area chart used for the 30-day sign-up series.
 */
export function NewUsersChart({ data = [], locale = 'en', rtl = false, height = 240 }) {
  const { t } = useTranslation();
  const gradientId = useId().replace(/:/g, '');

  return (
    <div style={{ height }} role="img" aria-label={t('admin.dashboard.charts.newUsersAria')}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: rtl ? 0 : 8, left: rtl ? 8 : 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.users.fill} stopOpacity={0.34} />
              <stop offset="100%" stopColor={SERIES.users.fill} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            reversed={rtl}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickFormatter={(value) => formatDay(value, locale)}
          />
          <YAxis
            orientation={rtl ? 'right' : 'left'}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={34}
            tickFormatter={(value) => compactNumber(value, locale)}
          />
          <Tooltip
            cursor={{ stroke: 'rgb(var(--sand-300))', strokeDasharray: '3 4' }}
            content={<ChartTooltip locale={locale} labelFormatter={(value) => formatDay(value, locale)} />}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={SERIES.users.stroke}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Bar chart used for resources added per day.
 */
export function NewResourcesChart({ data = [], locale = 'en', rtl = false, height = 240 }) {
  const { t } = useTranslation();

  return (
    <div style={{ height }} role="img" aria-label={t('admin.dashboard.charts.newResourcesAria')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: rtl ? 0 : 8, left: rtl ? 8 : 0, bottom: 0 }}
        >
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            reversed={rtl}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tickFormatter={(value) => formatDay(value, locale)}
          />
          <YAxis
            orientation={rtl ? 'right' : 'left'}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={30}
            tickFormatter={(value) => compactNumber(value, locale)}
          />
          <Tooltip
            cursor={{ fill: 'rgb(var(--sand-100))' }}
            content={<ChartTooltip locale={locale} labelFormatter={(value) => formatDay(value, locale)} />}
          />
          <Bar
            dataKey="count"
            fill={SERIES.resources.fill}
            radius={[6, 6, 0, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Donut with a centred total and a legend rendered outside the SVG (easier to
 * theme, translate and mirror than Recharts' built-in legend).
 *
 * `data`: [{ key, label, value, color }]
 */
export function BreakdownDonut({
  data = [],
  total = 0,
  centerLabel,
  locale = 'en',
  height = 190
}) {
  const { t } = useTranslation();
  const visible = data.filter((entry) => entry.value > 0);
  const safeTotal = visible.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div
        className="relative shrink-0"
        style={{ width: height, height }}
        role="img"
        aria-label={t('admin.dashboard.charts.breakdownAria', { total: safeTotal })}
      >
        {safeTotal > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={visible}
                dataKey="value"
                nameKey="label"
                innerRadius="64%"
                outerRadius="92%"
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {visible.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip locale={locale} />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full w-full place-items-center rounded-full border-[14px] border-sand-100" />
        )}

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="font-display text-2xl font-semibold leading-none text-ink">
              {formatNumber(total, locale)}
            </p>
            {centerLabel && <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-muted">{centerLabel}</p>}
          </div>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-2">
        {data.map((entry) => {
          const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <li key={entry.key} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-ink-soft">{entry.label}</span>
              <span className="font-semibold tabular-nums text-ink">{formatNumber(entry.value, locale)}</span>
              <span className="w-9 text-end text-[11px] tabular-nums text-ink-muted">{percent}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

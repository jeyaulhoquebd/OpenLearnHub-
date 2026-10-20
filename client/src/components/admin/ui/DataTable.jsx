import { Fragment, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Inbox
} from 'lucide-react';
import { formatNumber } from '../../../lib/utils';

function Checkbox({ checked, indeterminate = false, onChange, label, disabled = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.checked)}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-sand-300 text-accent-600 accent-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500"
    />
  );
}

/**
 * Sortable, selectable, paginated table for the admin panel.
 *
 * Paging and sorting are controlled by the caller (`pagination`, `sort`,
 * `onSortChange`) so the same component works for client-side demo data and for
 * server-side queries later.
 *
 * columns: [{ key, header, sortable, render(row), className, align }]
 */
export default function DataTable({
  columns = [],
  rows = [],
  rowKey = (row) => row.id,
  rowClassName,
  renderExpandedRow,
  expandedRowKeys = [],
  loading = false,
  skeletonRows = 5,
  emptyTitle,
  emptyText,
  emptyIcon: EmptyIcon = Inbox,
  emptyAction,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  sort = null,
  onSortChange,
  pagination = null,
  caption,
  maxHeight,
  className = ''
}) {
  const { t, i18n } = useTranslation();
  const columnCount = columns.length + (selectable ? 1 : 0);
  const selected = new Set(selectedIds);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(rowKey(row)));
  const someSelected = rows.some((row) => selected.has(rowKey(row)));

  function toggleAll(next) {
    if (!onSelectionChange) return;
    onSelectionChange(next ? rows.map((row) => rowKey(row)) : []);
  }

  function toggleOne(id, next) {
    if (!onSelectionChange) return;
    const draft = new Set(selectedIds);
    if (next) draft.add(id);
    else draft.delete(id);
    onSelectionChange(Array.from(draft));
  }

  function toggleSort(key) {
    if (!onSortChange) return;
    const direction = sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc';
    onSortChange({ key, dir: direction });
  }

  function ariaSort(key) {
    if (sort?.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  const page = pagination?.page || 1;
  const pageSize = pagination?.pageSize || rows.length || 10;
  const total = pagination?.total ?? rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageSizeOptions = pagination?.pageSizeOptions || [10, 25, 50];

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-sand-200 bg-surface shadow-soft ${className}`}
    >
      <div
        className="overflow-x-auto"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        <table className="min-w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}

          <thead className="sticky top-0 z-10 bg-sand-50/95 backdrop-blur">
            <tr className="border-b border-sand-200">
              {selectable && (
                <th scope="col" className="w-10 px-4 py-3 text-start">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    label={t('admin.ui.selectAll')}
                    disabled={loading || rows.length === 0}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sortable ? ariaSort(column.key) : undefined}
                  className={`whitespace-nowrap px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted ${
                    column.headerClassName || ''
                  }`}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1.5 rounded-md uppercase tracking-[0.12em] transition hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-500"
                    >
                      {column.header}
                      {sort?.key === column.key ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-accent-600" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-accent-600" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-sand-100">
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {Array.from({ length: columnCount }).map((__, cellIndex) => (
                    <td key={`skeleton-${rowIndex}-${cellIndex}`} className="px-4 py-4">
                      <span className="skeleton block h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-6 py-14">
                  <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sand-100 text-ink-muted">
                      <EmptyIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="mt-3 font-display text-base font-semibold text-ink">
                      {emptyTitle || t('admin.ui.emptyTitle')}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                      {emptyText || t('admin.ui.emptyText')}
                    </p>
                    {emptyAction && <div className="mt-4">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const id = rowKey(row);
                const expanded = Boolean(renderExpandedRow) && expandedRowKeys.includes(id);
                return (
                  <Fragment key={id || index}>
                    <tr
                      className={`transition hover:bg-sand-50 ${
                        selected.has(id) ? 'bg-accent-50/60 dark:bg-accent-500/5' : ''
                      } ${rowClassName ? rowClassName(row) : ''}`}
                    >
                      {selectable && (
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selected.has(id)}
                            onChange={(next) => toggleOne(id, next)}
                            label={t('admin.ui.selectRow')}
                          />
                        </td>
                      )}
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={`px-4 py-3 align-middle text-ink-soft ${
                            column.align === 'end' ? 'text-end' : 'text-start'
                          } ${column.className || ''}`}
                        >
                          {column.render ? column.render(row, index) : row[column.key] ?? '—'}
                        </td>
                      ))}
                    </tr>
                    {expanded && (
                      <tr className="bg-sand-50/80 dark:bg-white/[0.02]">
                        <td colSpan={columnCount} className="px-4 py-4">
                          {renderExpandedRow(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 bg-sand-50/70 px-4 py-3 text-xs text-ink-muted">
          <p>
            {t('admin.ui.pageOf', {
              page: formatNumber(page, i18n.language),
              total: formatNumber(pageCount, i18n.language)
            })}
            <span className="mx-1.5 text-sand-300">·</span>
            {t('admin.ui.total', { count: formatNumber(total, i18n.language) })}
          </p>

          <div className="flex items-center gap-2">
            {pagination.onPageSizeChange && (
              <label className="hidden items-center gap-1.5 sm:inline-flex">
                <span className="sr-only">{t('admin.ui.rowsPerPage')}</span>
                <select
                  value={pageSize}
                  onChange={(event) => pagination.onPageSizeChange(Number(event.target.value))}
                  className="rounded-lg border border-sand-300 bg-surface px-2 py-1.5 text-xs font-semibold text-ink-soft focus-visible:ring-2 focus-visible:ring-accent-500"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="button"
              onClick={() => pagination.onPageChange?.(page - 1)}
              disabled={page <= 1 || loading}
              className="grid h-8 w-8 place-items-center rounded-lg border border-sand-300 bg-surface text-ink-soft transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t('admin.ui.previous')}
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => pagination.onPageChange?.(page + 1)}
              disabled={page >= pageCount || loading}
              className="grid h-8 w-8 place-items-center rounded-lg border border-sand-300 bg-surface text-ink-soft transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t('admin.ui.next')}
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

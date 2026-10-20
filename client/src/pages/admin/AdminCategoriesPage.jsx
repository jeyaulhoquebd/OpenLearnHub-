import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  FolderTree,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import Tabs from '../../components/admin/ui/Tabs';
import Modal from '../../components/admin/ui/Modal';
import ConfirmDialog from '../../components/admin/ui/ConfirmDialog';
import CategoryDrawer from '../../components/admin/categories/CategoryDrawer';
import { getCategoryIcon } from '../../lib/categoryIcons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createAdminCategory,
  deleteAdminCategory,
  listAdminCategories,
  moveCategoryResources,
  reorderAdminCategories,
  updateAdminCategory
} from '../../lib/api';
import { localized } from '../../lib/utils';

const TABS = ['course', 'book', 'software'];

/**
 * Reorders the full list the same way the server does: the dragged (visible)
 * rows move together to the position of the first visible row, then every row
 * is renumbered. Keeping both sides identical means the optimistic UI never
 * disagrees with the saved order.
 */
function applyLocalReorder(allItems, visibleIds) {
  const visibleSet = new Set(visibleIds);
  const sorted = [...allItems].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const firstIndex = sorted.findIndex((item) => visibleSet.has(item.id));
  if (firstIndex === -1) return allItems;

  const byId = new Map(sorted.map((item) => [item.id, item]));
  const before = sorted.slice(0, firstIndex).filter((item) => !visibleSet.has(item.id));
  const after = sorted.slice(firstIndex).filter((item) => !visibleSet.has(item.id));
  const finalIds = [...before, ...visibleIds.map((id) => byId.get(id)), ...after];

  return finalIds.map((item, index) => ({ ...item, order: index + 1 }));
}

/** One draggable category row. */
function SortableCategoryRow({ category, disabled, onEdit, onDelete }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = getCategoryIcon(category.icon);
  const translations = ['bn', 'ur']
    .map((code) => category.name?.[code])
    .filter(Boolean)
    .join(' · ');

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-2xl border border-sand-200 bg-surface px-3 py-3 shadow-soft transition ${
        isDragging ? 'z-10 opacity-80 shadow-lg' : ''
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={t('admin.categories.dragHandle', { name: localized(category.name) || category.id })}
        className="grid h-8 w-6 shrink-0 cursor-grab place-items-center rounded text-ink-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        style={category.color ? { backgroundColor: `${category.color}1F`, color: category.color } : undefined}
      >
        <Icon
          className={`h-5 w-5 ${category.color ? '' : 'text-accent-600 dark:text-accent-300'}`}
          aria-hidden="true"
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-ink">
            {localized(category.name) || t('admin.categories.untitled')}
          </p>
          {category.type === 'all' && (
            <span className="chip border border-sand-300 bg-sand-100 text-ink-muted">
              {t('admin.categories.shared')}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-ink-muted">
          {translations || t('admin.categories.noTranslations')}
        </p>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <code className="rounded bg-sand-100 px-1.5 py-0.5 text-[11px] text-ink-muted" dir="ltr">
          /{category.slug}
        </code>
        <span className="text-[11px] font-medium text-ink-soft">
          {t('admin.categories.resourceCount', { count: category.resourceCount || 0 })}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(category)}
          aria-label={t('admin.categories.actions.edit', {
            name: localized(category.name) || category.id
          })}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-sand-100 hover:text-ink"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(category)}
          aria-label={t('admin.categories.actions.delete', {
            name: localized(category.name) || category.id
          })}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function RowSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-surface px-3 py-3">
      <span className="skeleton h-8 w-6 rounded" />
      <span className="skeleton h-10 w-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <span className="skeleton block h-4 w-40 rounded" />
        <span className="skeleton block h-3 w-24 rounded" />
      </div>
      <span className="skeleton hidden h-4 w-24 rounded sm:block" />
    </li>
  );
}

/**
 * Categories manager.
 *
 * Tabs filter by resource type; "shared" categories (`type: 'all'`) show in
 * every tab. Drag-and-drop saves a single reorder request, and deleting a
 * category that resources still use is turned into a "move then delete" flow.
 */
export default function AdminCategoriesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('course');
  const [reloadToken, setReloadToken] = useState(0);
  const [orderSaving, setOrderSaving] = useState(false);

  const [drawer, setDrawer] = useState({ open: false, category: null });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [move, setMove] = useState(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [moving, setMoving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const data = await listAdminCategories(token);
      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const visible = useMemo(
    () =>
      items
        .filter((category) => category.type === tab || category.type === 'all')
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
    [items, tab]
  );

  const tabItems = useMemo(
    () =>
      TABS.map((key) => ({
        key,
        label: t(`admin.categories.tabs.${key}`),
        badge: items.filter((category) => category.type === key || category.type === 'all').length
      })),
    [items, t]
  );

  const otherCategories = useMemo(
    () => items.filter((category) => category.id !== move?.category?.id),
    [items, move]
  );

  async function handleSubmit(payload) {
    setSaving(true);
    try {
      const token = await user.getIdToken();
      if (drawer.category) {
        await updateAdminCategory(drawer.category.id, payload, token);
        push(t('admin.categories.form.updateSuccess'), { type: 'success' });
      } else {
        await createAdminCategory(payload, token);
        push(t('admin.categories.form.createSuccess'), { type: 'success' });
      }
      setDrawer({ open: false, category: null });
      setReloadToken((value) => value + 1);
    } catch (err) {
      push(err.message || t('admin.categories.saveError'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || orderSaving) return;

    const visibleIds = visible.map((category) => category.id);
    const from = visibleIds.indexOf(active.id);
    const to = visibleIds.indexOf(over.id);
    if (from === -1 || to === -1) return;

    const previous = items;
    const nextVisibleIds = arrayMove(visibleIds, from, to);
    setItems(applyLocalReorder(items, nextVisibleIds));
    setOrderSaving(true);

    try {
      const token = await user.getIdToken();
      await reorderAdminCategories(nextVisibleIds, token);
      push(t('admin.categories.orderSaved'), { type: 'success' });
    } catch (err) {
      setItems(previous);
      push(err.message || t('admin.categories.orderError'), { type: 'error' });
    } finally {
      setOrderSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      await deleteAdminCategory(confirm.id, token);
      push(t('admin.categories.confirm.deleteSuccess'), { type: 'success' });
      setConfirm(null);
      setReloadToken((value) => value + 1);
    } catch (err) {
      push(err.message || t('admin.categories.saveError'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveAndDelete() {
    if (!move || !moveTarget) return;
    setMoving(true);
    try {
      const token = await user.getIdToken();
      const result = await moveCategoryResources(move.category.id, moveTarget, token);
      await deleteAdminCategory(move.category.id, token);
      push(t('admin.categories.confirm.moveSuccess', { count: result.moved || 0 }), {
        type: 'success'
      });
      setMove(null);
      setMoveTarget('');
      setReloadToken((value) => value + 1);
    } catch (err) {
      push(err.message || t('admin.categories.saveError'), { type: 'error' });
    } finally {
      setMoving(false);
    }
  }

  function requestDelete(category) {
    if ((category.resourceCount || 0) > 0) {
      setMoveTarget('');
      setMove({ category });
    } else {
      setConfirm(category);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('admin.categories.title')}
        description={t('admin.categories.subtitle')}
        actions={
          <>
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              disabled={loading}
              className="btn-secondary"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('admin.categories.refresh')}
            </button>
            <button
              type="button"
              onClick={() => setDrawer({ open: true, category: null })}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('admin.categories.newCategory')}
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={tabItems}
          value={tab}
          onChange={setTab}
          ariaLabel={t('admin.categories.tabsLabel')}
        />
        <p className="text-xs text-ink-muted">{t('admin.categories.tabsHint')}</p>
      </div>

      {error ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.categories.errorTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {t('admin.categories.errorText')}
          </p>
          {error?.message ? (
            <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">{error.message}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="btn-secondary mt-4"
          >
            {t('admin.categories.retry')}
          </button>
        </div>
      ) : loading ? (
        <ul className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <RowSkeleton key={`category-skeleton-${index}`} />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <FolderTree className="mx-auto h-10 w-10 text-ink-muted" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.categories.emptyTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {t('admin.categories.emptyText')}
          </p>
          <button
            type="button"
            onClick={() => setDrawer({ open: true, category: null })}
            className="btn-primary mt-4"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('admin.categories.newCategory')}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center">
          <FolderTree className="mx-auto h-10 w-10 text-ink-muted" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.categories.emptyFilteredTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {t('admin.categories.emptyFilteredText')}
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={visible.map((category) => category.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {visible.map((category) => (
                <SortableCategoryRow
                  key={category.id}
                  category={category}
                  disabled={orderSaving}
                  onEdit={(item) => setDrawer({ open: true, category: item })}
                  onDelete={requestDelete}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {orderSaving && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {t('admin.categories.savingOrder')}
        </p>
      )}

      <CategoryDrawer
        open={drawer.open}
        category={drawer.category}
        defaultType={tab}
        saving={saving}
        onClose={() => setDrawer({ open: false, category: null })}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        loading={saving}
        title={t('admin.categories.confirm.deleteTitle')}
        message={t('admin.categories.confirm.deleteMessage', {
          name: localized(confirm?.name) || ''
        })}
        confirmLabel={t('admin.categories.confirm.deleteConfirm')}
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />

      <Modal
        open={Boolean(move)}
        onClose={moving ? () => {} : () => setMove(null)}
        size="md"
        title={t('admin.categories.confirm.deleteInUseTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={() => setMove(null)}
              disabled={moving}
              className="btn-secondary"
            >
              {t('admin.ui.cancel')}
            </button>
            <button
              type="button"
              onClick={handleMoveAndDelete}
              disabled={moving || !moveTarget}
              className="btn-primary"
            >
              {moving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t('admin.categories.confirm.moveAndDelete')}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          {t('admin.categories.confirm.deleteInUseMessage', {
            count: move?.category?.resourceCount || 0,
            name: localized(move?.category?.name) || ''
          })}
        </p>
        <div className="mt-4">
          <label
            htmlFor="move-target"
            className="block text-sm font-semibold text-ink"
          >
            {t('admin.categories.confirm.moveTarget')}
          </label>
          <select
            id="move-target"
            value={moveTarget}
            onChange={(event) => setMoveTarget(event.target.value)}
            className="input mt-1.5"
          >
            <option value="">{t('admin.categories.confirm.movePlaceholder')}</option>
            {otherCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {localized(category.name) || category.id}
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}

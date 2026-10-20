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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2
} from 'lucide-react';
import PageHeader from '../../components/admin/ui/PageHeader';
import ConfirmDialog from '../../components/admin/ui/ConfirmDialog';
import AlternativeFormModal from '../../components/admin/alternatives/AlternativeFormModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createAdminAlternative,
  deleteAdminAlternative,
  listAdminAlternatives,
  reorderAdminAlternatives,
  setAdminAlternativeActive,
  updateAdminAlternative
} from '../../lib/api';
import { localized } from '../../lib/utils';

function initialOf(name = '') {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/** One draggable "Paid → Free" card. */
function SortableAlternativeCard({
  alternative,
  disabled,
  busy,
  onEdit,
  onDelete,
  onToggleActive
}) {
  const { t, i18n } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: alternative.id,
    disabled
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const free = alternative.freeResource;
  const note = alternative.note?.[i18n.language] || alternative.note?.en || '';
  const active = alternative.active !== false;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`flex flex-col rounded-2xl border border-sand-200 bg-surface p-4 shadow-soft transition ${
        isDragging ? 'z-10 opacity-80 shadow-lg' : ''
      } ${active ? '' : 'opacity-70'}`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            aria-label={t('admin.alternatives.dragHandle', { name: alternative.paidSoftware })}
            className="grid h-8 w-6 cursor-grab place-items-center rounded text-ink-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
          {!active && (
            <span className="chip border border-sand-300 bg-sand-100 text-ink-muted">
              {t('admin.alternatives.inactive')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={active}
            disabled={busy}
            aria-label={t('admin.alternatives.toggleActive')}
            onClick={() => onToggleActive(alternative, !active)}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
              active
                ? 'border-accent-500 bg-accent-500'
                : 'border-sand-300 bg-sand-200 dark:bg-navy-700'
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                active ? 'start-6' : 'start-0.5'
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => onEdit(alternative)}
            aria-label={t('admin.alternatives.actions.edit', { name: alternative.paidSoftware })}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-sand-100 hover:text-ink"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(alternative)}
            aria-label={t('admin.alternatives.actions.delete', { name: alternative.paidSoftware })}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mt-4 flex items-stretch gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-sand-200 bg-sand-50 text-base font-bold text-ink-muted">
            {alternative.paidSoftwareLogoUrl ? (
              <img
                src={alternative.paidSoftwareLogoUrl}
                alt=""
                className="h-full w-full object-contain p-1"
                loading="lazy"
              />
            ) : (
              initialOf(alternative.paidSoftware)
            )}
          </span>
          <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink">
            {alternative.paidSoftware}
          </p>
          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
            {t('admin.alternatives.paidLabel')}
          </p>
        </div>

        <div className="flex flex-col items-center justify-center">
          <ArrowRight className="h-5 w-5 text-accent-500 rtl:rotate-180" aria-hidden="true" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-accent-200 bg-accent-500/10 text-accent-700 dark:border-accent-500/40 dark:text-accent-300">
            {free?.thumbnailUrl ? (
              <img src={free.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink">
            {free ? localized(free.title) || free.id : t('admin.alternatives.missingShort')}
          </p>
          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
            {t('admin.alternatives.freeLabel')}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-soft">
        {note || t('admin.alternatives.noteFallback')}
      </p>

      {!free && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('admin.alternatives.missingResource')}
        </p>
      )}
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-sand-200 bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="skeleton h-4 w-24 rounded" />
        <span className="skeleton h-6 w-11 rounded-full" />
      </div>
      <div className="mt-4 flex gap-3">
        <span className="skeleton h-12 w-12 rounded-xl" />
        <span className="skeleton h-12 w-6 rounded" />
        <span className="skeleton h-12 w-12 rounded-xl" />
      </div>
      <span className="skeleton mt-3 block h-3 w-full rounded" />
    </div>
  );
}

/**
 * "Free alternatives" manager.
 *
 * Each card pairs a paid product with a published software resource. Cards are
 * drag-reorderable, can be toggled active (which is what the home page reads)
 * and are edited in a modal with a searchable resource picker.
 */
export default function AdminAlternativesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [orderSaving, setOrderSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [modal, setModal] = useState({ open: false, alternative: null });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [token, setToken] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ordered = useMemo(
    () => [...items].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
    [items]
  );

  const activeCount = useMemo(() => items.filter((item) => item.active !== false).length, [items]);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      setToken(idToken);
      const data = await listAdminAlternatives(idToken);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  async function handleSubmit(payload) {
    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      if (modal.alternative) {
        await updateAdminAlternative(modal.alternative.id, payload, idToken);
        push(t('admin.alternatives.form.updateSuccess'), { type: 'success' });
      } else {
        await createAdminAlternative(payload, idToken);
        push(t('admin.alternatives.form.createSuccess'), { type: 'success' });
      }
      setModal({ open: false, alternative: null });
      setReloadToken((value) => value + 1);
    } catch (err) {
      push(err.message || t('admin.alternatives.saveError'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(alternative, nextActive) {
    const previous = items;
    setBusyId(alternative.id);
    setItems((list) =>
      list.map((item) => (item.id === alternative.id ? { ...item, active: nextActive } : item))
    );

    try {
      const idToken = await user.getIdToken();
      await setAdminAlternativeActive(alternative.id, nextActive, idToken);
      push(nextActive ? t('admin.alternatives.toggleOn') : t('admin.alternatives.toggleOff'), {
        type: 'success'
      });
    } catch (err) {
      setItems(previous);
      push(err.message || t('admin.alternatives.saveError'), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!confirm) return;
    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      await deleteAdminAlternative(confirm.id, idToken);
      push(t('admin.alternatives.confirm.deleteSuccess'), { type: 'success' });
      setConfirm(null);
      setReloadToken((value) => value + 1);
    } catch (err) {
      push(err.message || t('admin.alternatives.saveError'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || orderSaving) return;

    const ids = ordered.map((item) => item.id);
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from === -1 || to === -1) return;

    const previous = items;
    const nextIds = arrayMove(ids, from, to);
    const byId = new Map(items.map((item) => [item.id, item]));
    setItems(nextIds.map((id, index) => ({ ...byId.get(id), order: index + 1 })));
    setOrderSaving(true);

    try {
      const idToken = await user.getIdToken();
      await reorderAdminAlternatives(nextIds, idToken);
      push(t('admin.alternatives.orderSaved'), { type: 'success' });
    } catch (err) {
      setItems(previous);
      push(err.message || t('admin.alternatives.orderError'), { type: 'error' });
    } finally {
      setOrderSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('admin.alternatives.title')}
        description={t('admin.alternatives.subtitle')}
        actions={
          <>
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              disabled={loading}
              className="btn-secondary"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('admin.alternatives.refresh')}
            </button>
            <button
              type="button"
              onClick={() => setModal({ open: true, alternative: null })}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('admin.alternatives.newAlternative')}
            </button>
          </>
        }
      />

      <p className="mb-4 text-xs text-ink-muted">
        {t('admin.alternatives.counts', { active: activeCount, total: items.length })}
      </p>

      {error ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-500" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.alternatives.errorTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {t('admin.alternatives.errorText')}
          </p>
          {error?.message ? (
            <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">{error.message}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="btn-secondary mt-4"
          >
            {t('admin.alternatives.retry')}
          </button>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={`alternative-skeleton-${index}`} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <ArrowLeftRight className="mx-auto h-10 w-10 text-ink-muted" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {t('admin.alternatives.emptyTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {t('admin.alternatives.emptyText')}
          </p>
          <button
            type="button"
            onClick={() => setModal({ open: true, alternative: null })}
            className="btn-primary mt-4"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('admin.alternatives.newAlternative')}
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ordered.map((item) => item.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {ordered.map((alternative) => (
                <SortableAlternativeCard
                  key={alternative.id}
                  alternative={alternative}
                  disabled={orderSaving}
                  busy={busyId === alternative.id}
                  onEdit={(item) => setModal({ open: true, alternative: item })}
                  onDelete={setConfirm}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {orderSaving && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {t('admin.alternatives.savingOrder')}
        </p>
      )}

      <AlternativeFormModal
        open={modal.open}
        alternative={modal.alternative}
        token={token}
        saving={saving}
        onClose={() => setModal({ open: false, alternative: null })}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        loading={saving}
        title={t('admin.alternatives.confirm.deleteTitle')}
        message={t('admin.alternatives.confirm.deleteMessage', {
          paid: confirm?.paidSoftware || '',
          free: localized(confirm?.freeResource?.title) || t('admin.alternatives.freeLabel')
        })}
        confirmLabel={t('admin.alternatives.confirm.deleteConfirm')}
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

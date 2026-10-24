import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  FileText,
  Globe2,
  Languages,
  Layers3,
  Lightbulb,
  ListVideo,
  Loader2,
  LogIn,
  MessageSquare,
  NotebookPen,
  PlayCircle,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Youtube
} from 'lucide-react';
import CoursePlayer from '../components/CoursePlayer';
import ResourceCard from '../components/ResourceCard';
import ReviewSection from '../components/ReviewSection';
import EmptyState from '../components/EmptyState';
import { PageLoader } from '../components/LoadingStates';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { useResources } from '../hooks/useResources';
import {
  deleteCourseNote,
  fetchCourseNotes,
  fetchCourseProgress,
  fetchCourseVideos,
  fetchResourceById,
  getRelatedResources,
  saveCourseNote,
  saveCourseProgress
} from '../lib/data';
import { COUNTRY_FLAGS } from '../lib/constants';
import { localized } from '../lib/utils';

const TABS = ['notes', 'practice', 'about'];

function ProgressBar({ value, label }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-ink-muted">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-200" aria-hidden="true">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Focused on-site course experience.
 *
 * The route intentionally removes the usual marketing chrome around the video:
 * the learner can follow the ordered lesson list, take per-video notes, mark
 * lessons complete and use a short practice/reflection panel without YouTube
 * recommendations pulling them away.
 */
export default function CoursePlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isAdmin, user, firebaseReady } = useAuth();
  const { push } = useToast();
  const { resources } = useResources();
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('notes');
  const [courseProgress, setCourseProgress] = useState({
    status: 'not_started',
    completedVideoIds: [],
    lastVideoId: null
  });
  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteStatus, setNoteStatus] = useState('');
  const [progressBusy, setProgressBusy] = useState(false);
  const resumeApplied = useRef(false);

  const localizedTitle = localized(resource?.title, i18n.language);
  const localizedDescription = localized(resource?.description, i18n.language);
  const localizedLongDescription =
    localized(resource?.longDescription, i18n.language) || localizedDescription;

  usePageMeta(
    localizedTitle ? `${localizedTitle} — ${t('youtubeCourse.playerTitle')}` : t('youtubeCourse.loading'),
    localizedDescription
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setVideos([]);
    setVideosLoading(true);
    setCurrentIndex(0);
    setNotes([]);
    setNoteDraft('');
    resumeApplied.current = false;

    fetchResourceById(id)
      .then((item) => {
        if (active) {
          setResource(item);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.warn('[course-player]', error);
        if (active) {
          setResource(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!resource?.id) return undefined;
    let active = true;
    setVideosLoading(true);
    fetchCourseVideos(resource.id)
      .then((items) => {
        if (active) {
          setVideos(items);
          setVideosLoading(false);
        }
      })
      .catch((error) => {
        console.warn('[course-player] videos', error);
        if (active) {
          setVideos([]);
          setVideosLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [resource?.id]);

  useEffect(() => {
    if (!resource?.id) return undefined;
    if (!user) {
      setCourseProgress({ status: 'not_started', completedVideoIds: [], lastVideoId: null });
      setNotes([]);
      return undefined;
    }

    let active = true;
    Promise.all([
      fetchCourseProgress(user.uid, resource.id),
      fetchCourseNotes(user.uid, resource.id)
    ])
      .then(([progress, savedNotes]) => {
        if (!active) return;
        setCourseProgress(progress);
        setNotes(savedNotes);
      })
      .catch((error) => console.warn('[course-player] learner data', error));

    return () => {
      active = false;
    };
  }, [resource?.id, user]);

  // Resume at the last lesson once both the lesson list and saved progress exist.
  useEffect(() => {
    if (resumeApplied.current || !videos.length) return;
    const savedIndex = courseProgress.lastVideoId
      ? videos.findIndex((video) => video.videoId === courseProgress.lastVideoId)
      : -1;
    if (savedIndex > 0) setCurrentIndex(savedIndex);
    resumeApplied.current = true;
  }, [videos, courseProgress.lastVideoId]);

  const currentVideo = videos[currentIndex] || null;
  const completedSet = useMemo(
    () => new Set(courseProgress.completedVideoIds || []),
    [courseProgress.completedVideoIds]
  );
  const completedCount = completedSet.size;
  const progressPercent = videos.length
    ? Math.round((completedCount / videos.length) * 100)
    : 0;

  const currentNote = useMemo(
    () => notes.find((note) => note.videoId === currentVideo?.videoId) || null,
    [notes, currentVideo?.videoId]
  );

  useEffect(() => {
    setNoteDraft(currentNote?.body || '');
    setNoteStatus('');
  }, [currentNote?.videoId, currentNote?.body]);

  const related = useMemo(
    () =>
      getRelatedResources(resources, resource, 6)
        .filter((item) => item.type === 'course')
        .slice(0, 3),
    [resources, resource]
  );

  function signInFor() {
    navigate('/login', {
      state: { from: `${window.location.pathname}${window.location.search}` }
    });
  }

  function selectLesson(index) {
    if (index < 0 || index >= videos.length) return;
    setCurrentIndex(index);
    setActiveTab((tab) => (tab === 'about' ? 'notes' : tab));

    if (user && firebaseReady) {
      const nextVideo = videos[index];
      const nextStatus =
        courseProgress.status === 'not_started' ? 'in_progress' : courseProgress.status;
      setCourseProgress((current) => ({
        ...current,
        status: nextStatus,
        lastVideoId: nextVideo.videoId
      }));
      saveCourseProgress(user.uid, resource.id, {
        status: nextStatus,
        lastVideoId: nextVideo.videoId
      }).catch(() => {});
    }
  }

  async function toggleLessonComplete(videoId) {
    if (!videoId) return;
    if (!firebaseReady) {
      push(t('config.previewText'), { type: 'info' });
      return;
    }
    if (!user) {
      signInFor();
      return;
    }
    if (progressBusy) return;

    const next = new Set(completedSet);
    if (next.has(videoId)) next.delete(videoId);
    else next.add(videoId);
    const completedVideoIds = Array.from(next);
    const status =
      videos.length > 0 && completedVideoIds.length >= videos.length
        ? 'completed'
        : completedVideoIds.length > 0
          ? 'in_progress'
          : 'not_started';

    const previous = courseProgress;
    setProgressBusy(true);
    setCourseProgress((current) => ({ ...current, completedVideoIds, status }));
    try {
      await saveCourseProgress(user.uid, resource.id, {
        status,
        completedVideoIds,
        lastVideoId: videoId
      });
    } catch (error) {
      console.warn('[course-player] progress', error);
      setCourseProgress(previous);
      push(t('youtubeCourse.progressSaveError'), { type: 'error' });
    } finally {
      setProgressBusy(false);
    }
  }

  async function handleVideoEnded() {
    // Completion from the player is idempotent. The button below can toggle a
    // lesson off, but reaching the end of a finished lesson must not undo it.
    if (currentVideo && !completedSet.has(currentVideo.videoId)) {
      await toggleLessonComplete(currentVideo.videoId);
    }
  }

  async function saveNote() {
    if (!user) {
      signInFor();
      return;
    }
    if (!currentVideo || noteBusy) return;
    setNoteBusy(true);
    setNoteStatus('');
    try {
      await saveCourseNote({
        uid: user.uid,
        resourceId: resource.id,
        videoId: currentVideo.videoId,
        videoTitle: currentVideo.title,
        body: noteDraft
      });
      const fresh = await fetchCourseNotes(user.uid, resource.id);
      setNotes(fresh);
      setNoteStatus('saved');
    } catch (error) {
      console.warn('[course-player] note', error);
      setNoteStatus('error');
      push(t('youtubeCourse.noteError'), { type: 'error' });
    } finally {
      setNoteBusy(false);
    }
  }

  async function removeNote(note) {
    if (!user || !note?.videoId) return;
    try {
      await deleteCourseNote(user.uid, resource.id, note.videoId);
      setNotes((current) => current.filter((entry) => entry.videoId !== note.videoId));
      if (note.videoId === currentVideo?.videoId) setNoteDraft('');
      push(t('youtubeCourse.noteDeleted'));
    } catch (error) {
      console.warn('[course-player] delete note', error);
      push(t('youtubeCourse.noteError'), { type: 'error' });
    }
  }

  if (loading) return <PageLoader label={t('youtubeCourse.loading')} />;

  if (!resource) {
    return (
      <div className="container-page section">
        <EmptyState
          title={t('youtubeCourse.notFoundTitle')}
          text={t('youtubeCourse.notFoundText')}
          action={
            <Link to="/courses" className="btn-primary">
              {t('resource.back')}
            </Link>
          }
        />
      </div>
    );
  }

  const isPending = resource.status && resource.status !== 'published';
  const canPreview = isAdmin || (user?.uid && resource.createdBy === user.uid);
  if (isPending && !canPreview) {
    return (
      <div className="container-page section">
        <EmptyState
          title={t('youtubeCourse.notFoundTitle')}
          text={t('youtubeCourse.notFoundText')}
          action={
            <Link to="/courses" className="btn-primary">
              {t('resource.back')}
            </Link>
          }
        />
      </div>
    );
  }

  // A non-YouTube resource should use the normal detail page instead.
  if (!resource.youtubePlaylistId) {
    return <Navigate to={`/resource/${resource.id}`} replace />;
  }

  const externalUrl = resource.sourceUrl;

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 bg-navy-950 pb-10 pt-8 text-white sm:pb-12">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
        <div className="pointer-events-none absolute -end-28 -top-28 h-80 w-80 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="container-page relative">
          <Link
            to={`/resource/${resource.id}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-navy-100/75 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('youtubeCourse.backToCourse')}
          </Link>

          <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-inset ring-white/20">
                  <Youtube className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('youtubeCourse.adminBadge')}
                </span>
                {resource.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-100 ring-1 ring-inset ring-accent-300/30">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {t('common.verified')}
                  </span>
                )}
                {resource.level && (
                  <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-navy-100/80">
                    {resource.level}
                  </span>
                )}
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-navy-200/70">
                {resource.sourceName}
              </p>
              <h1 className="mt-2 max-w-4xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                {localizedTitle}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-navy-100/75 sm:text-base">
                {localizedDescription}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t('youtubeCourse.watchOnYouTube')}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            <CoursePlayer
              resource={resource}
              videos={videos}
              currentIndex={currentIndex}
              onVideoEnded={handleVideoEnded}
            />

            {videos.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-surface px-4 py-3 shadow-soft">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectLesson(currentIndex - 1)}
                    disabled={currentIndex <= 0}
                    className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    {t('youtubeCourse.previousLesson')}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectLesson(currentIndex + 1)}
                    disabled={currentIndex >= videos.length - 1}
                    className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t('youtubeCourse.nextLesson')}
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleLessonComplete(currentVideo?.videoId)}
                  disabled={!currentVideo || progressBusy}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                    completedSet.has(currentVideo?.videoId)
                      ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30'
                      : 'bg-brand-700 text-white hover:bg-brand-800'
                  }`}
                >
                  {completedSet.has(currentVideo?.videoId) ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4" aria-hidden="true" />
                  )}
                  {completedSet.has(currentVideo?.videoId)
                    ? t('youtubeCourse.completed')
                    : t('youtubeCourse.markComplete')}
                </button>
              </div>
            )}

            {videosLoading && (
              <div className="flex items-center gap-2 rounded-2xl border border-sand-200 bg-surface px-4 py-3 text-xs text-ink-muted shadow-soft">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('youtubeCourse.loadingLessons')}
              </div>
            )}

            <div className="card overflow-hidden">
              <div
                role="tablist"
                aria-label={t('youtubeCourse.learningTools')}
                className="flex flex-wrap gap-1 border-b border-sand-100 bg-sand-50/70 p-2"
              >
                {TABS.map((tab) => {
                  const Icon =
                    tab === 'notes' ? NotebookPen : tab === 'practice' ? Target : FileText;
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        activeTab === tab
                          ? 'bg-surface text-ink shadow-sm'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {t(`youtubeCourse.tabs.${tab}`)}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'notes' && (
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-ink">
                        {t('youtubeCourse.notesTitle')}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                        {currentVideo
                          ? t('youtubeCourse.notesForLesson', { lesson: currentVideo.title })
                          : t('youtubeCourse.notesSelectLesson')}
                      </p>
                    </div>
                    {currentVideo && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-200">
                        <ListVideo className="h-3.5 w-3.5" aria-hidden="true" />
                        {currentIndex + 1}/{videos.length}
                      </span>
                    )}
                  </div>

                  {!user ? (
                    <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 text-center">
                      <LogIn className="mx-auto h-6 w-6 text-brand-700" aria-hidden="true" />
                      <p className="mt-2 text-sm font-semibold text-brand-950">
                        {t('youtubeCourse.notesSignInTitle')}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-brand-900/75">
                        {t('youtubeCourse.notesSignInText')}
                      </p>
                      <button
                        type="button"
                        onClick={() => signInFor()}
                        className="btn-primary mt-4"
                      >
                        {t('common.signIn')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={noteDraft}
                        onChange={(event) => {
                          setNoteDraft(event.target.value.slice(0, 4000));
                          setNoteStatus('');
                        }}
                        rows={7}
                        disabled={!currentVideo || noteBusy}
                        placeholder={
                          currentVideo
                            ? t('youtubeCourse.notePlaceholder')
                            : t('youtubeCourse.notesSelectLesson')
                        }
                        className="input mt-5 resize-y"
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[11px] text-ink-muted">
                          {noteDraft.length}/4000
                          {noteStatus === 'saved' && (
                            <span className="ms-2 font-semibold text-emerald-700 dark:text-emerald-300">
                              {t('youtubeCourse.noteSaved')}
                            </span>
                          )}
                          {noteStatus === 'error' && (
                            <span className="ms-2 font-semibold text-rose-700 dark:text-rose-300">
                              {t('youtubeCourse.noteError')}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={saveNote}
                          disabled={!currentVideo || noteBusy}
                          className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {noteBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Save className="h-4 w-4" aria-hidden="true" />
                          )}
                          {t('youtubeCourse.saveNote')}
                        </button>
                      </div>

                      <div className="mt-7 border-t border-sand-100 pt-5">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                          <MessageSquare className="h-4 w-4 text-brand-600" aria-hidden="true" />
                          {t('youtubeCourse.allNotes', { count: notes.length })}
                        </h3>
                        {notes.length === 0 ? (
                          <p className="mt-3 rounded-xl bg-sand-50 px-3 py-2 text-xs leading-relaxed text-ink-muted">
                            {t('youtubeCourse.noNotes')}
                          </p>
                        ) : (
                          <ul className="mt-3 space-y-2">
                            {notes.map((note) => {
                              const videoIndex = videos.findIndex(
                                (video) => video.videoId === note.videoId
                              );
                              return (
                                <li
                                  key={note.id || note.videoId}
                                  className="rounded-xl border border-sand-200 bg-surface p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (videoIndex >= 0) selectLesson(videoIndex);
                                      }}
                                      className="min-w-0 text-start"
                                    >
                                      <p className="truncate text-xs font-semibold text-brand-800 dark:text-brand-300">
                                        {note.videoTitle ||
                                          t('youtubeCourse.lessonCounter', {
                                            current: videoIndex >= 0 ? videoIndex + 1 : '?',
                                            total: videos.length
                                          })}
                                      </p>
                                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                                        {note.body}
                                      </p>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeNote(note)}
                                      className="rounded-full p-1.5 text-ink-muted transition hover:bg-rose-50 hover:text-rose-700"
                                      aria-label={t('youtubeCourse.deleteNote')}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'practice' && (
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-ink">
                        {t('youtubeCourse.practiceTitle')}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                        {t('youtubeCourse.practiceSubtitle')}
                      </p>
                    </div>
                    <div className="min-w-[12rem] rounded-2xl border border-brand-200 bg-brand-50/60 px-4 py-3">
                      <ProgressBar value={progressPercent} label={t('youtubeCourse.courseProgress')} />
                      <p className="mt-2 text-[11px] font-semibold text-brand-900/70">
                        {t('youtubeCourse.completedCount', {
                          done: completedCount,
                          total: videos.length
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      ['practicePrompt1', Lightbulb],
                      ['practicePrompt2', Target],
                      ['practicePrompt3', Trophy]
                    ].map(([key, Icon]) => (
                      <div
                        key={key}
                        className="rounded-2xl border border-sand-200 bg-sand-50/70 p-4"
                      >
                        <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
                        <p className="mt-2 text-xs font-semibold leading-relaxed text-ink-soft">
                          {t(`youtubeCourse.${key}`)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleLessonComplete(currentVideo?.videoId)}
                      disabled={!currentVideo || progressBusy}
                      className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {completedSet.has(currentVideo?.videoId) ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      )}
                      {completedSet.has(currentVideo?.videoId)
                        ? t('youtubeCourse.completed')
                        : t('youtubeCourse.markComplete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('notes')}
                      className="btn-secondary btn-sm"
                    >
                      <NotebookPen className="h-4 w-4" aria-hidden="true" />
                      {t('youtubeCourse.writeNote')}
                    </button>
                  </div>

                  {videos.length > 0 && (
                    <div className="mt-6 border-t border-sand-100 pt-5">
                      <h3 className="text-sm font-bold text-ink">{t('youtubeCourse.lessonChecklist')}</h3>
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {videos.map((video, index) => (
                          <li key={video.id || video.videoId}>
                            <button
                              type="button"
                              onClick={() => selectLesson(index)}
                              className="flex w-full items-center gap-2 rounded-xl border border-sand-200 px-3 py-2 text-start text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-900"
                            >
                              {completedSet.has(video.videoId) ? (
                                <CheckCircle2
                                  className="h-4 w-4 shrink-0 text-emerald-600"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Circle
                                  className="h-4 w-4 shrink-0 text-ink-muted"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate">{video.title}</span>
                              <span className="tabular-nums text-[10px] text-ink-muted">
                                {video.durationText}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'about' && (
                <div className="p-5 sm:p-6">
                  <h2 className="font-display text-2xl font-semibold text-ink">
                    {t('youtubeCourse.courseAbout')}
                  </h2>
                  <div className="mt-4 space-y-4 text-[15px] leading-7 text-ink-soft">
                    {(localizedLongDescription || '')
                      .split('\n')
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                  </div>

                  {resource.tags?.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-2 border-t border-sand-100 pt-5">
                      {resource.tags.map((tag) => (
                        <Link
                          key={tag}
                          to={`/explore?q=${encodeURIComponent(tag)}`}
                          className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-800"
                        >
                          {tag}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-surface text-brand-700 shadow-sm ring-1 ring-brand-100">
                        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-brand-950">
                          {t('youtubeCourse.verifiedNote')}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-brand-900/75">
                          {t('youtubeCourse.playerNote')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <ReviewSection resourceId={resource.id} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {videos.length > 0 && (
              <div className="card overflow-hidden">
                <div className="border-b border-sand-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                      <ListVideo className="h-4 w-4 text-brand-600" aria-hidden="true" />
                      {t('youtubeCourse.courseContent')}
                    </h2>
                    <span className="text-[11px] font-semibold text-ink-muted">
                      {videos.length} {t('youtubeCourse.lessons')}
                    </span>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={progressPercent} label={t('youtubeCourse.courseProgress')} />
                  </div>
                </div>
                <ol className="max-h-[28rem] overflow-y-auto p-2">
                  {videos.map((video, index) => {
                    const active = index === currentIndex;
                    const done = completedSet.has(video.videoId);
                    return (
                      <li key={video.id || video.videoId}>
                        <button
                          type="button"
                          onClick={() => selectLesson(index)}
                          aria-current={active ? 'true' : undefined}
                          className={`flex w-full items-start gap-2.5 rounded-xl p-2 text-start transition ${
                            active
                              ? 'bg-brand-50 text-brand-950 dark:bg-brand-500/10 dark:text-brand-100'
                              : 'text-ink-soft hover:bg-sand-50'
                          }`}
                        >
                          <span
                            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                              done
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : active
                                  ? 'bg-brand-700 text-white'
                                  : 'bg-sand-100 text-ink-muted'
                            }`}
                          >
                            {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-xs font-semibold leading-relaxed">
                              {video.title}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-ink-muted">
                              {video.durationText}
                            </span>
                          </span>
                          {active && (
                            <PlayCircle
                              className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            <div className="card p-5">
              <h2 className="text-sm font-bold text-ink">{t('youtubeCourse.courseDetails')}</h2>
              <dl className="mt-4 divide-y divide-sand-100 text-sm">
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <Youtube className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('youtubeCourse.sourceLabel')}
                  </dt>
                  <dd className="mt-1 ps-7 font-medium text-ink">{resource.sourceName}</dd>
                </div>
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <Layers3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('resource.category')}
                  </dt>
                  <dd className="mt-1 ps-7 font-medium text-ink">{resource.category}</dd>
                </div>
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('resource.level')}
                  </dt>
                  <dd className="mt-1 ps-7 font-medium text-ink">{resource.level}</dd>
                </div>
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('resource.languages')}
                  </dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5 ps-7">
                    {(resource.languages || []).map((language) => (
                      <span
                        key={language}
                        className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-ink-soft"
                      >
                        {language}
                      </span>
                    ))}
                  </dd>
                </div>
                {resource.countries?.length > 0 && (
                  <div className="py-3">
                    <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                      <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {t('resource.regions')}
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5 ps-7">
                      {resource.countries.map((country) => (
                        <span
                          key={country}
                          className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-ink-soft"
                        >
                          <span aria-hidden="true">{COUNTRY_FLAGS[country]}</span>
                          {country}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                <div className="py-3">
                  <dt className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('resource.license')}
                  </dt>
                  <dd className="mt-1 ps-7 font-medium text-ink">{resource.license}</dd>
                </div>
              </dl>

              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4 w-full justify-center"
              >
                {t('youtubeCourse.watchOnYouTube')}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-muted">
                <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                {t('resource.officialSource')}
              </p>
            </div>

            <p className="rounded-2xl border border-sand-200 bg-surface px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
              <PlayCircle className="me-1.5 inline h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
              {t('youtubeCourse.progressHint')}
            </p>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
                {t('youtubeCourse.relatedCourses')}
              </h2>
              <Link to="/courses" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
                {t('common.viewAll')}
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <ResourceCard key={item.id} resource={item} compact />
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

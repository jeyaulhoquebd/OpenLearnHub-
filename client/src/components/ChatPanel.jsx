import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Bot,
  Compass,
  ExternalLink,
  Loader2,
  LogIn,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { askLearnMate } from '../lib/api';
import { isPublicSitePath } from '../lib/publicSiteRoutes';
import RichText from './RichText';

const SUGGESTIONS = ['assistant.suggestion1', 'assistant.suggestion2', 'assistant.suggestion3'];

export default function ChatPanel({ variant = 'widget', onClose }) {
  const { t, i18n } = useTranslation();
  const { user, firebaseReady, loading } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || sending || loading) return;
    if (!user) return;

    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setSending(true);

    try {
      const token = await user.getIdToken();
      const response = await askLearnMate({
        messages: nextMessages.slice(-8),
        locale: i18n.language,
        token
      });
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: response?.reply || '',
          sources: Array.isArray(response?.sources) ? response.sources : [],
          sitePages: Array.isArray(response?.sitePages) ? response.sitePages : []
        }
      ]);
    } catch (requestError) {
      setError(requestError?.message || t('assistant.error'));
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  const heightClass = variant === 'page' ? 'h-[30rem]' : 'h-[21rem]';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-sand-200 bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-3.5 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/15 ring-1 ring-inset ring-white/25">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold leading-none">{t('assistant.name')}</p>
            <p className="mt-1 text-[11px] font-medium text-white/70">{t('assistant.title')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError('');
              }}
              className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
              aria-label={t('assistant.newChat')}
              title={t('assistant.newChat')}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!firebaseReady ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Bot className="h-9 w-9 text-ink-muted" />
          <p className="text-sm font-semibold text-ink">{t('config.previewTitle')}</p>
          <p className="max-w-xs text-xs leading-relaxed text-ink-muted">{t('auth.configText')}</p>
        </div>
      ) : loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center" role="status" aria-live="polite">
          <Loader2 className="h-7 w-7 animate-spin text-brand-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">{t('common.loading')}</p>
          <p className="max-w-xs text-xs leading-relaxed text-ink-muted">{t('assistant.title')}</p>
        </div>
      ) : !user ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <LogIn className="h-5 w-5" />
          </span>
          <p className="font-display text-lg font-semibold text-ink">{t('assistant.signInTitle')}</p>
          <p className="max-w-xs text-sm leading-relaxed text-ink-soft">{t('assistant.signInText')}</p>
          <Link to="/login" className="btn-primary mt-2" onClick={onClose}>
            {t('common.signIn')}
          </Link>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className={`flex-1 space-y-4 overflow-y-auto bg-sand-50/60 p-4 ${heightClass}`}
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div className="rounded-2xl border border-sand-200 bg-surface p-4">
                <div className="flex items-center gap-2 text-brand-800">
                  <Bot className="h-4 w-4" />
                  <p className="text-xs font-bold uppercase tracking-wider">{t('assistant.name')}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('assistant.welcome')}</p>
                <div className="mt-4 space-y-2">
                  {SUGGESTIONS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => sendMessage(t(key))}
                      className="w-full rounded-xl border border-sand-200 bg-sand-50 px-3.5 py-2.5 text-start text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-900"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <span
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    message.role === 'user' ? 'bg-ink text-white' : 'bg-navy-800 text-white'
                  }`}
                >
                  {message.role === 'user' ? <UserRound className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </span>
                <div className={`max-w-[85%] ${message.role === 'user' ? 'items-end text-end' : ''}`}>
                  <div
                    className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-ink text-white'
                        : 'border border-sand-200 bg-surface text-ink-soft'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <RichText text={message.content} />
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.sources?.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                        {t('assistant.sources')}
                      </p>
                      {message.sources.map((source) => (
                        <a
                          key={source.id || source.url}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 rounded-xl border border-sand-200 bg-surface px-3 py-2 text-xs font-medium text-brand-800 transition hover:border-brand-300"
                        >
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="line-clamp-2">{source.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {message.sitePages?.some((page) => isPublicSitePath(page.path)) && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                        {t('assistant.sitePages')}
                      </p>
                      {message.sitePages
                        .filter((page) => isPublicSitePath(page.path))
                        .map((page) => (
                          <Link
                            key={page.path}
                            to={page.path}
                            onClick={onClose}
                            className="group flex items-start gap-3 rounded-2xl border border-brand-200/80 bg-gradient-to-br from-brand-50/90 to-surface px-3.5 py-3 text-start transition hover:border-brand-400 hover:shadow-soft dark:from-brand-900/20"
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-800/50 dark:text-brand-100">
                              <Compass className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-bold text-ink">{page.title}</span>
                              <span className="mt-1 block text-[11px] leading-relaxed text-ink-muted">
                                {page.description}
                              </span>
                            </span>
                            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brand-700 transition group-hover:translate-x-0.5 rtl:rotate-180" />
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-2.5 text-sm text-ink-muted">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-navy-800 text-white">
                  <Bot className="h-3.5 w-3.5" />
                </span>
                <span className="inline-flex items-center gap-2 rounded-2xl border border-sand-200 bg-surface px-3.5 py-2.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                  {t('assistant.thinking')}
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-sand-200 bg-surface p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={1500}
                placeholder={t('assistant.placeholder')}
                className="input max-h-28 min-h-[2.75rem] flex-1 resize-none py-3"
                aria-label={t('assistant.placeholder')}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="btn-primary h-11 w-11 shrink-0 p-0"
                aria-label={t('assistant.send')}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-muted">
              {t('assistant.disclaimer')}
            </p>
          </form>
        </>
      )}
    </div>
  );
}

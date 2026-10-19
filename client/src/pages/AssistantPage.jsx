import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Check, Layers3, MessageSquare, Route, ShieldCheck, Sparkles, Target } from 'lucide-react';
import ChatPanel from '../components/ChatPanel';
import RoadmapBuilder from '../components/RoadmapBuilder';
import { usePageMeta } from '../hooks/usePageMeta';

export default function AssistantPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('chat');
  usePageMeta(t('assistant.pageTitle'), t('assistant.pageText'));

  const capabilities = [
    { icon: Target, text: t('assistant.capability1') },
    { icon: Layers3, text: t('assistant.capability2') },
    { icon: Bot, text: t('assistant.capability3') }
  ];

  const tabs = [
    { key: 'chat', label: t('assistant.tabChat'), icon: MessageSquare },
    { key: 'roadmap', label: t('assistant.tabRoadmap'), icon: Route }
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-gradient-to-br from-brand-50 via-white to-amber-50/50 pb-10 pt-10 sm:pb-14 dark:via-transparent dark:to-accent-500/10">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="pointer-events-none absolute -end-24 -top-24 h-80 w-80 rounded-full bg-brand-100/70 blur-3xl" />
        <div className="container-page relative">
          <span className="eyebrow">
            <span className="h-px w-7 bg-navy-500" />
            {t('assistant.pageEyebrow')}
          </span>
          <h1 className="display-title mt-3 max-w-3xl">{t('assistant.pageTitle')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">{t('assistant.pageText')}</p>
        </div>
      </section>

      <section className="container-page py-9 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-3xl border border-brand-200 bg-brand-50/70 p-6">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy-800 text-white shadow-soft">
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-display text-2xl font-semibold text-brand-950">{t('assistant.title')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-900/75">{t('assistant.subtitle')}</p>
              <ul className="mt-5 space-y-3">
                {capabilities.map((capability) => {
                  const Icon = capability.icon;
                  return (
                    <li key={capability.text} className="flex items-start gap-2.5 text-sm text-brand-900/80">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface text-brand-700 shadow-sm">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {capability.text}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-3xl border border-sand-200 bg-surface p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <ShieldCheck className="h-4 w-4 text-brand-700" />
                {t('home.legalEyebrow')}
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-soft">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                  {t('assistant.pageNote')}
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                  {t('assistant.disclaimer')}
                </li>
              </ul>
            </div>
          </aside>

          <div className="overflow-hidden rounded-3xl border border-sand-200 bg-surface shadow-float">
            <div className="flex items-center gap-1 border-b border-sand-200 bg-sand-50 px-2 pt-2" role="tablist">
              {tabs.map((item) => {
                const Icon = item.icon;
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(item.key)}
                    className={`relative flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${
                      active ? 'text-brand-800' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-navy-700" />}
                  </button>
                );
              })}
            </div>
            {tab === 'chat' ? <ChatPanel variant="page" /> : <RoadmapBuilder />}
          </div>
        </div>
      </section>
    </>
  );
}

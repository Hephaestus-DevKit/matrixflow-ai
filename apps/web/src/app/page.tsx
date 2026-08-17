import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { PublicFooter, PublicHeader } from '@/components/public-shell';
import { LocalizedText, type MessageKey } from '@/lib/i18n';
import {
  Bot,
  Factory,
  Library,
  GitFork,
  MessageSquare,
  Store,
  ArrowRight,
  Sparkles,
  Database,
  Layers3,
  ShieldCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const OPERATING_FLOW: Array<{
  icon: typeof Database;
  step: string;
  title: MessageKey;
  description: MessageKey;
}> = [
  {
    icon: Database,
    step: '01',
    title: 'public.preview.step1',
    description: 'public.preview.step1Description',
  },
  {
    icon: Layers3,
    step: '02',
    title: 'public.preview.step2',
    description: 'public.preview.step2Description',
  },
  {
    icon: ShieldCheck,
    step: '03',
    title: 'public.preview.step3',
    description: 'public.preview.step3Description',
  },
];

export default function LandingPage() {
  return (
    <div className="dark isolate flex min-h-screen flex-col overflow-x-clip bg-background text-foreground antialiased selection:bg-primary/30">
      <PublicHeader />

      <main id="main-content" className="relative flex-1">
        {/* Hero */}
        <section className="landing-hero relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden px-4 py-14 sm:px-6 sm:py-16 lg:py-20">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="landing-grid absolute inset-0" />
            <div className="landing-aurora landing-aurora-violet" />
            <div className="landing-aurora landing-aurora-blue" />
            <div className="landing-aurora landing-aurora-cyan" />
            <div className="landing-ribbon" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/75 to-transparent" />
          </div>

          <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,0.96fr)_minmax(440px,1.04fr)] lg:gap-14">
            <div className="animate-fade-in text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-4 py-1.5 text-xs font-semibold text-violet-200 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-md">
                <Sparkles className="h-3 w-3 animate-pulse" aria-hidden="true" />
                <LocalizedText id="public.heroEyebrow" />
              </div>
              <h1 className="mx-auto max-w-[34rem] text-[clamp(2.25rem,3.2vw,3.1rem)] font-extrabold leading-[1.07] tracking-[-0.04em] text-white [text-wrap:balance] lg:mx-0">
                <LocalizedText id="public.heroTitle" />
                <span className="mt-2 block bg-gradient-to-r from-violet-300 via-violet-400 to-indigo-300 bg-clip-text text-transparent">
                  <LocalizedText id="public.heroTitleAccent" />
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-[32rem] text-[0.9375rem] leading-7 text-slate-300 sm:text-base lg:mx-0">
                <LocalizedText id="public.heroDescription" />
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Button
                  asChild
                  size="lg"
                  className="landing-primary-action w-48 gap-2 text-sm font-semibold sm:w-auto"
                >
                  <Link href="/register">
                    <LocalizedText id="public.registerLong" />{' '}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-48 border-white/15 bg-white/[0.035] text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/[0.09] hover:text-white sm:w-auto"
                >
                  <Link href="#capabilities">
                    <LocalizedText id="public.capabilities" />
                  </Link>
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[0.6875rem] font-medium text-slate-300 lg:justify-start">
                {(
                  [
                    'public.trust.isolation',
                    'public.trust.traceable',
                    'public.trust.safeFailure',
                  ] as const
                ).map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1.5 backdrop-blur-sm"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153/0.7)]"
                      aria-hidden="true"
                    />
                    <LocalizedText id={item} />
                  </span>
                ))}
              </div>
            </div>

            <div className="landing-console-shell relative mx-auto w-full max-w-lg">
              <div className="landing-console-glow absolute -inset-10 -z-10 rounded-[4rem]" />
              <div className="landing-console overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/55 backdrop-blur-2xl">
                <div className="flex flex-col items-start gap-3 border-b border-white/10 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="brand-mark h-8 w-8 rounded-lg text-xs" aria-hidden="true">
                      M
                    </span>
                    <div>
                      <p className="text-xs font-bold">
                        <LocalizedText id="public.preview.label" />
                      </p>
                      <p className="text-[0.6875rem] text-slate-400">
                        <LocalizedText id="public.preview.description" />
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-violet-300/15 bg-violet-400/10 px-2.5 py-1 text-[0.6875rem] font-bold text-violet-200">
                    <LocalizedText id="public.preview.dataLayer" />
                  </span>
                </div>
                <div className="space-y-2.5 p-4">
                  {OPERATING_FLOW.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.step}>
                        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5 sm:gap-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-300/10 bg-violet-400/10 text-violet-300">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-violet-300">
                              <LocalizedText id="public.preview.stepLabel" /> {item.step}
                            </p>
                            <p className="mt-0.5 text-sm font-bold">
                              <LocalizedText id={item.title} />
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                              <LocalizedText id={item.description} />
                            </p>
                          </div>
                          <span className="hidden rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-1 text-[0.6875rem] font-semibold text-slate-400 sm:block">
                            <LocalizedText
                              id={
                                index === 2
                                  ? 'public.preview.reviewable'
                                  : 'public.preview.arranged'
                              }
                            />
                          </span>
                        </div>
                        {index < OPERATING_FLOW.length - 1 && (
                          <div className="ml-9 h-2.5 w-px bg-gradient-to-b from-violet-400/55 to-white/10" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 bg-white/[0.025] px-2 py-3.5 text-center sm:px-5">
                  {[
                    ['12', 'public.preview.formats'],
                    ['public.preview.team', 'public.preview.boundaries'],
                    ['public.preview.fullPath', 'public.preview.runs'],
                  ].map(([value, label]) => (
                    <div key={label} className="px-2">
                      <p className="text-sm font-black">
                        {value === '12' ? value : <LocalizedText id={value as MessageKey} />}
                      </p>
                      <p className="mt-0.5 text-[0.6875rem] text-slate-400">
                        <LocalizedText id={label as MessageKey} />
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="capabilities"
          className="landing-section relative scroll-mt-16 border-t border-white/[0.08] px-4 py-20 sm:py-24"
        >
          <div className="relative z-10 mx-auto max-w-6xl">
            <div className="mb-14 text-center sm:mb-16">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl lg:text-[2.25rem]">
                <LocalizedText id="public.features.title" />
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                <LocalizedText id="public.features.description" />
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Bot,
                  title: 'public.feature.agents.title',
                  desc: 'public.feature.agents.description',
                },
                {
                  icon: Factory,
                  title: 'public.feature.content.title',
                  desc: 'public.feature.content.description',
                },
                {
                  icon: Library,
                  title: 'public.feature.knowledge.title',
                  desc: 'public.feature.knowledge.description',
                },
                {
                  icon: GitFork,
                  title: 'public.feature.workflows.title',
                  desc: 'public.feature.workflows.description',
                },
                {
                  icon: MessageSquare,
                  title: 'public.feature.crm.title',
                  desc: 'public.feature.crm.description',
                },
                {
                  icon: Store,
                  title: 'public.feature.marketplace.title',
                  desc: 'public.feature.marketplace.description',
                },
              ].map((f) => {
                const IconComponent = f.icon;
                return (
                  <div key={f.title} className="landing-feature-card p-6">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/10 bg-violet-400/10 text-violet-300">
                      <IconComponent className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="mb-2 text-base font-semibold text-white">
                      <LocalizedText id={f.title as MessageKey} />
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-400 sm:text-sm">
                      <LocalizedText id={f.desc as MessageKey} />
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="landing-cta-section relative overflow-hidden border-t border-white/[0.08] px-4 py-20 text-center sm:py-24">
          <div className="landing-cta-panel relative z-10 mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 px-6 py-14 sm:px-12 sm:py-16">
            <div
              className="absolute left-1/2 top-0 h-48 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/20 blur-3xl"
              aria-hidden="true"
            />
            <h2 className="relative mb-4 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
              <LocalizedText id="public.cta.title" />
            </h2>
            <p className="relative mx-auto mb-8 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
              <LocalizedText id="public.cta.description" />
            </p>
            <Button asChild size="lg" className="landing-primary-action relative">
              <Link href="/register">
                <LocalizedText id="public.registerLong" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

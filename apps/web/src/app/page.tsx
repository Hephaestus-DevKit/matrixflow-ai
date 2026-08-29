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
    <div className="landing-page isolate flex min-h-screen flex-col overflow-x-clip antialiased selection:bg-primary/20">
      <PublicHeader />

      <main id="main-content" className="relative flex-1">
        {/* Hero */}
        <section className="landing-hero relative flex min-h-[calc(100svh-3.75rem)] items-center overflow-hidden px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="landing-grid absolute inset-0" />
            <div className="landing-aurora landing-aurora-violet" />
            <div className="landing-aurora landing-aurora-blue" />
            <div className="landing-aurora landing-aurora-cyan" />
            <div className="landing-ambient landing-ambient-one" />
            <div className="landing-ambient landing-ambient-two" />
            <div className="landing-ambient landing-ambient-three" />
            <div className="landing-hero-fade absolute inset-x-0 bottom-0 h-48" />
          </div>

          <div className="relative z-10 mx-auto grid w-full max-w-[74rem] items-center gap-10 sm:gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.96fr)] lg:gap-16">
            <div className="animate-fade-in text-center lg:text-left">
              <div className="mb-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-slate-200/75 bg-white/[0.72] px-3.5 py-1.5 text-2xs font-semibold leading-4 text-slate-600 shadow-[0_10px_28px_-22px_rgb(30_41_59/0.32),inset_0_1px_0_rgb(255_255_255/0.9)] backdrop-blur-xl sm:mb-7 sm:px-4 sm:text-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <LocalizedText id="public.heroEyebrow" />
              </div>
              <h1 className="font-display mx-auto max-w-[38rem] text-[clamp(2.15rem,3.35vw,3.55rem)] font-semibold leading-[1.06] tracking-[-0.047em] text-slate-950 [text-wrap:balance] lg:mx-0">
                <LocalizedText id="public.heroTitle" />{' '}
                <span className="mt-2 block bg-gradient-to-r from-[#5f50cf] via-[#6258d6] to-[#3569a9] bg-clip-text text-transparent">
                  <LocalizedText id="public.heroTitleAccent" />
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-[33rem] text-[0.9375rem] leading-6 text-slate-600 sm:mt-7 sm:text-base sm:leading-7 lg:mx-0">
                <LocalizedText id="public.heroDescription" />
              </p>
              <div className="mt-7 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:justify-center lg:justify-start">
                <Button
                  asChild
                  size="lg"
                  className="landing-primary-action w-48 gap-2 rounded-full text-sm font-semibold sm:w-auto"
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
                  className="w-48 rounded-full border-slate-300/70 bg-white/[0.68] text-sm font-semibold text-slate-700 backdrop-blur-xl hover:border-slate-300 hover:bg-white hover:text-slate-950 sm:w-auto"
                >
                  <Link href="#capabilities">
                    <LocalizedText id="public.capabilities" />
                  </Link>
                </Button>
              </div>
              <div className="landing-trust-row mt-6 flex flex-wrap items-center justify-center gap-2 text-2xs font-medium text-slate-600 sm:mt-8 lg:justify-start">
                {(
                  [
                    'public.trust.isolation',
                    'public.trust.traceable',
                    'public.trust.safeFailure',
                  ] as const
                ).map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/[0.58] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.72)] backdrop-blur-xl"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgb(16_185_129/0.45)]"
                      aria-hidden="true"
                    />
                    <LocalizedText id={item} />
                  </span>
                ))}
              </div>
            </div>

            <div className="landing-console-shell relative mx-auto w-full max-w-lg">
              <div className="landing-console-glow absolute -inset-10 -z-10 rounded-[4rem]" />
              <div className="landing-console overflow-hidden rounded-[2rem] border border-white/[0.85] bg-white/[0.86] text-slate-900 backdrop-blur-2xl">
                <div className="flex flex-col items-start gap-2.5 border-b border-slate-200/80 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="brand-mark h-8 w-8 rounded-lg text-xs" aria-hidden="true">
                      M
                    </span>
                    <div>
                      <p className="text-xs font-bold">
                        <LocalizedText id="public.preview.label" />
                      </p>
                      <p className="text-2xs text-slate-500">
                        <LocalizedText id="public.preview.description" />
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-2xs font-bold text-primary">
                    <LocalizedText id="public.preview.dataLayer" />
                  </span>
                </div>
                <div className="space-y-2 p-3 sm:space-y-2.5 sm:p-4">
                  {OPERATING_FLOW.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.step}>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/[0.65] p-3 sm:gap-4 sm:p-3.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary sm:h-10 sm:w-10">
                            <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-2xs font-bold uppercase tracking-[0.14em] text-primary">
                              <LocalizedText id="public.preview.stepLabel" /> {item.step}
                            </p>
                            <p className="mt-0.5 text-sm font-bold">
                              <LocalizedText id={item.title} />
                            </p>
                            <p className="mt-0.5 text-xs leading-4 text-slate-500 sm:mt-1 sm:leading-5">
                              <LocalizedText id={item.description} />
                            </p>
                          </div>
                          <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-2xs font-semibold text-slate-500 sm:block">
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
                          <div className="ml-9 h-2.5 w-px bg-gradient-to-b from-primary/[0.45] to-slate-200" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-200/80 border-t border-slate-200/80 bg-slate-50/70 px-2 py-3.5 text-center sm:px-5">
                  {[
                    ['12', 'public.preview.formats'],
                    ['public.preview.team', 'public.preview.boundaries'],
                    ['public.preview.fullPath', 'public.preview.runs'],
                  ].map(([value, label]) => (
                    <div key={label} className="px-2">
                      <p className="font-display text-sm font-semibold">
                        {value === '12' ? value : <LocalizedText id={value as MessageKey} />}
                      </p>
                      <p className="mt-0.5 text-2xs text-slate-500">
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
          className="landing-section relative scroll-mt-16 px-4 py-20 sm:py-28"
        >
          <div className="relative z-10 mx-auto max-w-6xl">
            <div className="mb-11 text-center sm:mb-16">
              <h2 className="font-display text-[1.75rem] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.5rem] sm:leading-tight">
                <LocalizedText id="public.features.title" />
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                <LocalizedText id="public.features.description" />
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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
                  <div key={f.title} className="landing-feature-card p-6 sm:p-7">
                    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.075] text-primary sm:mb-5">
                      <IconComponent className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="font-display mb-2.5 text-[1.0625rem] font-semibold tracking-[-0.02em] text-slate-900">
                      <LocalizedText id={f.title as MessageKey} />
                    </h3>
                    <p className="text-sm leading-6 text-slate-600">
                      <LocalizedText id={f.desc as MessageKey} />
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="landing-cta-section relative overflow-hidden px-4 py-16 text-center sm:py-24">
          <div className="landing-cta-panel relative z-10 mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 px-5 py-11 sm:rounded-[2.25rem] sm:px-12 sm:py-16">
            <div
              className="absolute left-1/2 top-0 h-48 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/20 blur-3xl"
              aria-hidden="true"
            />
            <h2 className="font-display relative mb-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl">
              <LocalizedText id="public.cta.title" />
            </h2>
            <p className="relative mx-auto mb-6 max-w-2xl text-sm leading-6 text-slate-600 sm:mb-8 sm:text-base sm:leading-7">
              <LocalizedText id="public.cta.description" />
            </p>
            <Button asChild size="lg" className="landing-primary-action relative rounded-full">
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

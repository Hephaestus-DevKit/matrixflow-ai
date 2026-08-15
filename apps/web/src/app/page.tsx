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
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      <PublicHeader />

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-x-clip overflow-y-hidden px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
          <div className="absolute left-1/2 top-0 h-[620px] w-full max-w-7xl -translate-x-1/2 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]" />

          <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,0.94fr)_minmax(480px,1.06fr)] lg:gap-16">
            <div className="animate-fade-in text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm">
                <Sparkles className="h-3 w-3 animate-pulse" aria-hidden="true" />
                <LocalizedText id="public.heroEyebrow" />
              </div>
              <h1 className="text-4xl font-black leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[3.5rem]">
                <LocalizedText id="public.heroTitle" />
                <span className="mt-2 block bg-gradient-to-r from-violet-500 via-primary to-indigo-400 bg-clip-text text-transparent">
                  <LocalizedText id="public.heroTitleAccent" />
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8 lg:mx-0">
                <LocalizedText id="public.heroDescription" />
              </p>
              <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Button
                  asChild
                  size="lg"
                  className="gap-2 text-sm font-semibold shadow-glow transition-shadow duration-200 hover:shadow-glow-lg"
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
                  className="border-border text-sm font-semibold transition-colors hover:bg-muted/50"
                >
                  <Link href="#capabilities">
                    <LocalizedText id="public.capabilities" />
                  </Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground lg:justify-start">
                {(
                  [
                    'public.trust.isolation',
                    'public.trust.traceable',
                    'public.trust.safeFailure',
                  ] as const
                ).map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                    <LocalizedText id={item} />
                  </span>
                ))}
              </div>
            </div>

            <div
              className="relative mx-auto w-full max-w-xl overflow-x-clip"
              aria-label="MatrixFlow product workflow preview"
            >
              <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-primary/15 blur-3xl" />
              <div className="overflow-hidden rounded-[1.75rem] border border-border/75 bg-card/80 shadow-[0_32px_100px_-42px_hsl(var(--primary)/0.65)] backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="brand-mark h-8 w-8 rounded-lg text-xs" aria-hidden="true">
                      M
                    </span>
                    <div>
                      <p className="text-xs font-bold">
                        <LocalizedText id="public.preview.label" />
                      </p>
                      <p className="text-[0.6875rem] text-muted-foreground">
                        <LocalizedText id="public.preview.description" />
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[0.6875rem] font-bold text-primary">
                    <LocalizedText id="public.preview.dataLayer" />
                  </span>
                </div>
                <div className="space-y-3 p-4 sm:p-5">
                  {OPERATING_FLOW.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.step}>
                        <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-background/65 p-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-primary">
                              Step {item.step}
                            </p>
                            <p className="mt-0.5 text-sm font-bold">
                              <LocalizedText id={item.title} />
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              <LocalizedText id={item.description} />
                            </p>
                          </div>
                          <span className="hidden rounded-full bg-muted px-2 py-1 text-[0.6875rem] font-semibold text-muted-foreground sm:block">
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
                          <div className="ml-9 h-3 w-px bg-gradient-to-b from-primary/50 to-border" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 border-t border-border/70 bg-muted/20 px-5 py-4 text-center">
                  {[
                    ['12', 'public.preview.formats'],
                    ['public.preview.team', 'public.preview.boundaries'],
                    ['public.preview.fullPath', 'public.preview.runs'],
                  ].map(([value, label]) => (
                    <div key={label}>
                      <p className="text-sm font-black">
                        {value === '12' ? value : <LocalizedText id={value as MessageKey} />}
                      </p>
                      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
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
          className="relative scroll-mt-16 border-t border-border/40 bg-muted/10 px-4 py-24"
        >
          <div className="mx-auto max-w-6xl relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                <LocalizedText id="public.features.title" />
              </h2>
              <p className="mt-4 text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
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
              ].map((f, idx) => {
                const IconComponent = f.icon;
                return (
                  <div
                    key={idx}
                    className="group rounded-xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <h3 className="mb-2 font-semibold text-foreground group-hover:text-primary transition-colors text-base">
                      <LocalizedText id={f.title as MessageKey} />
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      <LocalizedText id={f.desc as MessageKey} />
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t border-border/40 px-4 py-24 text-center">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
              <LocalizedText id="public.cta.title" />
            </h2>
            <p className="mb-8 text-muted-foreground text-sm sm:text-base">
              <LocalizedText id="public.cta.description" />
            </p>
            <Button
              asChild
              size="lg"
              className="shadow-glow transition-shadow duration-200 hover:shadow-glow-lg"
            >
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

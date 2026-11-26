'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n';

const LABEL = { en: 'Team workspace', 'zh-CN': '团队空间', 'zh-TW': '團隊空間' } as const;

export function TeamSwitcher() {
  const { user, organizationId, setOrg } = useAuth();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const teams = user?.memberships ?? [];
  const current = teams.find((team) => team.organizationId === organizationId);
  const label = LABEL[locale];
  const name = current?.organizationName ?? label;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const options = list.current;
    const initial = options?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    (initial ?? options?.querySelector<HTMLButtonElement>('[role="option"]'))?.focus();
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  if (teams.length < 2) return null;

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const { key } = event;
    if (key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    );
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const last = options.length - 1;
    const next = {
      ArrowDown: Math.min(index + 1, last),
      ArrowUp: Math.max(index - 1, 0),
      Home: 0,
      End: last,
    };
    options[next[key as keyof typeof next]]?.focus();
  }

  return (
    <div
      ref={root}
      className="static shrink-0 min-[500px]:relative"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={current ? `${label}: ${name}` : label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={name}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-10 max-w-36 items-center gap-2 rounded-lg border border-transparent px-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted aria-expanded:border-border aria-expanded:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[500px]:px-2 sm:max-w-48"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Building2 size={15} aria-hidden="true" />
        </span>
        <span className="hidden min-w-0 truncate min-[360px]:block">{name}</span>
        <ChevronDown
          size={13}
          className={cn(
            'hidden shrink-0 text-muted-foreground min-[500px]:block',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          onKeyDown={navigate}
          className="absolute end-3 top-full z-[80] mt-2 max-h-[min(22rem,65dvh)] w-[min(17rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border bg-card p-1.5 shadow-lg min-[500px]:end-0"
        >
          <div aria-hidden="true" className="px-2.5 pb-1 pt-1.5 text-xs text-muted-foreground">
            {label}
          </div>
          {teams.map((team) => {
            const selected = team.organizationId === organizationId;
            return (
              <button
                key={team.organizationId}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={selected}
                onClick={() => {
                  if (!selected) setOrg(team.organizationId);
                  close();
                }}
                className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-sm font-medium hover:bg-muted aria-selected:bg-primary/10 aria-selected:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Building2
                  size={15}
                  className={cn('shrink-0', selected ? 'text-primary' : 'text-muted-foreground')}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  {team.organizationName}
                </span>
                {selected && (
                  <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

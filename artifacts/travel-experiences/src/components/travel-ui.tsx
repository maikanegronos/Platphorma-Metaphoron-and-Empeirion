import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth, useClerk, useUser } from '@clerk/react';
import { Compass, LayoutDashboard, CalendarDays, CarFront, ShieldCheck, Menu, X, ArrowUpRight, MapPin, Clock3, Users, Star, AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useHealthCheck, getHealthCheckQueryKey } from '@workspace/api-client-react';
import { roleLabel, useCurrentUser } from '@/lib/auth';

export function formatEuro(value: number) {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = { confirmed: 'Επιβεβαιωμένη', pending: 'Σε αναμονή', 'in-progress': 'Σε εξέλιξη', completed: 'Ολοκληρωμένη', cancelled: 'Ακυρωμένη', open: 'Ανοιχτή', claimed: 'Ανατέθηκε', approved: 'Εγκεκριμένος', rejected: 'Απορρίφθηκε' };
  const colors: Record<string, string> = { confirmed: 'bg-[#d8eee4] text-[#1b664c]', pending: 'bg-[#faeac4] text-[#85601a]', 'in-progress': 'bg-[#d6e8ed] text-[#19566c]', completed: 'bg-[#e5e7e6] text-[#52605e]', cancelled: 'bg-[#f9d9d5] text-[#9b3b32]', open: 'bg-[#faeac4] text-[#85601a]', claimed: 'bg-[#d6e8ed] text-[#19566c]', approved: 'bg-[#d8eee4] text-[#1b664c]', rejected: 'bg-[#f9d9d5] text-[#9b3b32]' };
  return <span data-testid={`status-${status}`} className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${colors[status] ?? 'bg-muted text-muted-foreground'}`}>{labels[status] ?? status}</span>;
}

export function LoadingState({ label = 'Φορτώνουμε τα δεδομένα…' }: { label?: string }) {
  return <div className="space-y-4" data-testid="state-loading"><div className="h-24 animate-pulse rounded-2xl bg-muted/70" /><div className="h-24 animate-pulse rounded-2xl bg-muted/70" /><p className="text-center text-sm text-muted-foreground">{label}</p></div>;
}

export function ErrorState({ onRetry, label = 'Κάτι δεν φόρτωσε σωστά.' }: { onRetry?: () => void; label?: string }) {
  return <div className="rounded-2xl border border-[#e5b2aa] bg-[#fff3f0] p-8 text-center" data-testid="state-error"><AlertCircle className="mx-auto mb-3 text-[#b24d42]" size={25} /><p className="font-semibold text-[#733b35]">{label}</p>{onRetry && <button data-testid="button-retry" onClick={onRetry} className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Δοκιμή ξανά</button>}</div>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center" data-testid="state-empty"><Compass className="mx-auto mb-3 text-accent" size={30} /><h3 className="font-display text-2xl">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const profile = useCurrentUser(Boolean(isSignedIn));
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60_000 } });
  const role = profile.data?.role;
  const navItems = [
    { href: '/', label: 'Ανακάλυψη', icon: Compass },
    ...(role === 'traveler' ? [{ href: '/bookings', label: 'Οι κρατήσεις μου', icon: CalendarDays }] : []),
    ...(role === 'driver' ? [{ href: '/driver', label: 'Πίνακας οδηγού', icon: CarFront }] : []),
    ...(role === 'operator' ? [{ href: '/admin', label: 'Έλεγχος συνεργατών', icon: ShieldCheck }] : []),
  ];
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'A'
    : 'A';
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName?.[0] ? `${user.lastName[0]}.` : ''}`
    : 'Επισκέπτης';
  return <div className="noise min-h-[100dvh] bg-background text-foreground">
    <aside className={`fixed inset-y-0 left-0 z-40 w-[272px] transform bg-primary px-6 py-7 text-primary-foreground shadow-2xl transition-transform md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between"><Link href="/" data-testid="link-brand" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-primary"><Compass size={22} /></span><span><strong className="font-display text-[22px]">Aperion</strong><small className="ml-1 block text-[9px] font-bold uppercase tracking-[.23em] text-primary-foreground/55">Travel days</small></span></Link><button data-testid="button-close-menu" className="md:hidden" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
       <div className="mt-12 space-y-2">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-nav-${label}`} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold ${location === href ? 'bg-primary-foreground/14 text-accent' : 'text-primary-foreground/70 hover:bg-primary-foreground/8 hover:text-primary-foreground'}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{href === '/bookings' && <span className="ml-auto rounded-full bg-accent/20 px-2 py-0.5 font-mono-ui text-[10px] text-accent">—</span>}</Link>)}</div>
      <div className="absolute bottom-7 left-6 right-6 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/6 p-4"><div className="mb-3 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-[#e6a29a]' : 'bg-[#8fd1af]'}`} /><span className="font-mono-ui text-[10px] uppercase tracking-wider text-primary-foreground/55">Σύστημα {health.isError ? 'σε έλεγχο' : 'ενεργό'}</span></div><p className="text-xs leading-5 text-primary-foreground/55">Μετακινήσεις με ρυθμό, φροντίδα και τοπική γνώση.</p></div>
    </aside>
     <div className="md:pl-[272px]"><header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-md md:px-10"><button data-testid="button-open-menu" className="rounded-lg p-2 hover:bg-muted md:hidden" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><div className="hidden md:block"><span className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-muted-foreground">Νησιά, πόλεις, ιστορίες</span></div><div className="flex items-center gap-3">{isSignedIn ? <><div className="hidden text-right sm:block"><p className="text-xs font-bold">{displayName}</p><p className="text-[10px] text-muted-foreground">{roleLabel(role)}</p></div><button type="button" onClick={() => signOut({ redirectUrl: '/' })} className="rounded-full bg-[#f2bf91] px-3 py-2 text-[10px] font-bold text-primary hover:bg-accent" data-testid="button-sign-out">Έξοδος</button><div data-testid="avatar-customer" className="grid h-9 w-9 place-items-center rounded-full bg-[#f2bf91] font-display text-sm text-primary">{initials}</div></> : <><Link href="/sign-in" data-testid="link-sign-in" className="text-xs font-bold text-primary hover:text-accent">Σύνδεση</Link><Link href="/sign-up" data-testid="link-sign-up" className="rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-[#285b6b]">Δημιούργησε λογαριασμό</Link></>}</div></header><main>{children}</main></div>
  </div>;
}

export function PageIntro({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="mb-9 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-accent">{eyebrow}</p><h1 className="mt-2 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-primary md:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p></div>{action && <div>{action}</div>}</div>;
}

export function MetricCard({ label, value, foot, accent = false, onClick }: { label: string; value: string; foot: string; accent?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`rounded-2xl border p-5 text-left ${accent ? 'border-accent/40 bg-accent/10' : 'border-border bg-card'} ${onClick ? 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md' : ''}`}><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">{label}</p><p className="mt-3 font-display text-3xl text-primary">{value}</p><p className="mt-1 text-xs text-muted-foreground">{foot}</p></Tag>;
}

export function DataTag({ children, icon: Icon = MapPin }: { children: ReactNode; icon?: typeof MapPin }) {
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Icon size={13} className="text-accent" />{children}</span>;
}

export function ActionButton({ children, loading, ...props }: { children: ReactNode; loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-[#285b6b] disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ''}`}>{loading && <LoaderCircle className="animate-spin" size={16} />}{children}</button>;
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-[#abd7bf] bg-[#eef9f2] p-4 text-sm text-[#246a4e]" data-testid="notice-success"><CheckCircle2 className="mt-0.5 shrink-0" size={18} /><span>{children}</span></div>;
}
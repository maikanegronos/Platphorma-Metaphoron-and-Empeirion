import { useState } from 'react';
import { CalendarDays, Check, Clock3, FileText, MapPin, ShieldCheck, Star, Users, X } from 'lucide-react';
import {
  getListAdminBookingsQueryKey,
  getListAdminDriverDocumentsQueryKey,
  getListAdminDriversQueryKey,
  useListAdminBookings,
  useListAdminDriverDocuments,
  useListAdminDrivers,
  useReviewDriver,
  useReviewDriverDocument,
} from '@workspace/api-client-react';
import type { Booking, Driver, DriverDocument } from '@workspace/api-client-react';
import { ActionButton, EmptyState, ErrorState, formatDate, formatEuro, LoadingState, MetricCard, PageIntro, StatusPill, SuccessNotice } from '@/components/travel-ui';
import { useQueryClient } from '@tanstack/react-query';

export default function Admin() {
  const drivers = useListAdminDrivers({ query: { queryKey: getListAdminDriversQueryKey(), staleTime: 60_000 } });
  const bookings = useListAdminBookings({ query: { queryKey: getListAdminBookingsQueryKey(), staleTime: 30_000 } });
  const documents = useListAdminDriverDocuments({ query: { queryKey: getListAdminDriverDocumentsQueryKey(), staleTime: 30_000 } });
  const review = useReviewDriver();
  const reviewDocument = useReviewDriverDocument();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [reviewingDocumentId, setReviewingDocumentId] = useState<string | null>(null);

  const decideDocument = (document: DriverDocument, status: 'approved' | 'rejected') => {
    setReviewingDocumentId(document.id);
    reviewDocument.mutate({ id: document.id, data: { status } }, {
      onSuccess: () => {
        setReviewingDocumentId(null);
        queryClient.invalidateQueries({ queryKey: getListAdminDriverDocumentsQueryKey() });
      },
      onError: () => setReviewingDocumentId(null),
    });
  };

  const decide = (driver: Driver, status: 'approved' | 'rejected') => {
    setNotice(null);
    setBusyId(driver.id);
    review.mutate({ id: driver.id, data: { status } }, {
      onSuccess: () => {
        setNotice(`${driver.name} ${status === 'approved' ? 'εγκρίθηκε' : 'απορρίφθηκε'} επιτυχώς.`);
        setBusyId(null);
        queryClient.invalidateQueries({ queryKey: getListAdminDriversQueryKey() });
      },
      onError: () => {
        setBusyId(null);
        setNotice('Η ενέργεια δεν ολοκληρώθηκε. Δοκίμασε ξανά.');
      },
    });
  };

  return <div className="min-h-[calc(100dvh-72px)] bg-[#f0eee8] px-5 py-8 md:px-10 md:py-12"><div className="mx-auto max-w-[1280px]">
    <PageIntro eyebrow="Operations / Admin" title="Οι σωστοί άνθρωποι, στο τιμόνι." detail="Έλεγξε τους συνεργάτες και κράτησε όλες τις κρατήσεις σε μία καθαρή επιχειρησιακή εικόνα." action={<div className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><ShieldCheck size={15} /> Κέντρο ελέγχου</div>} />
    <div className="mb-7 grid gap-3 md:grid-cols-4"><MetricCard label="Προς έγκριση" value={String(drivers.data?.filter((d) => d.status === 'pending').length ?? 0).padStart(2, '0')} foot="φάκελοι σε αναμονή" accent /><MetricCard label="Κρατήσεις" value={String(bookings.data?.length ?? 0)} foot="στο επιχειρησιακό queue" /><MetricCard label="Ανοιχτά jobs" value={String(bookings.data?.filter((b) => b.status === 'pending' || b.status === 'confirmed').length ?? 0)} foot="χωρίς ολοκλήρωση" /><MetricCard label="Συνεργάτες" value={String(drivers.data?.length ?? 0)} foot="στο δίκτυο σήμερα" /></div>
    {notice && <div className="mb-5"><SuccessNotice>{notice}</SuccessNotice></div>}
    <section className="mb-10"><div className="mb-4 flex items-end justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-accent">Live operations</p><h2 className="mt-2 font-display text-3xl text-primary">Κρατήσεις και dispatch</h2></div><p className="text-xs text-muted-foreground">Το κινητό είναι διαθέσιμο για την επικοινωνία με τον πελάτη.</p></div>{bookings.isLoading ? <LoadingState label="Φορτώνουμε τις κρατήσεις…" /> : bookings.isError ? <ErrorState onRetry={() => bookings.refetch()} label="Δεν μπορέσαμε να φορτώσουμε τις κρατήσεις." /> : (bookings.data ?? []).length === 0 ? <EmptyState title="Δεν υπάρχουν κρατήσεις." detail="Οι νέες κρατήσεις θα εμφανιστούν εδώ μόλις δημιουργηθούν." /> : <div className="grid gap-3">{(bookings.data ?? []).map((booking) => <BookingRow key={booking.id} booking={booking} />)}</div>}</section>
    <section><div className="mb-4"><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-accent">Partner review</p><h2 className="mt-2 font-display text-3xl text-primary">Οδηγοί και φάκελοι</h2></div>{drivers.isLoading ? <LoadingState label="Φορτώνουμε τους φακέλους συνεργατών…" /> : drivers.isError ? <ErrorState onRetry={() => drivers.refetch()} label="Δεν μπορέσαμε να φορτώσουμε τους οδηγούς." /> : (drivers.data ?? []).length === 0 ? <EmptyState title="Όλα τακτοποιημένα." detail="Δεν υπάρχουν οδηγοί που περιμένουν έλεγχο." /> : <div className="overflow-hidden rounded-2xl border border-[#d8d5cc] bg-card"><div className="hidden grid-cols-[1.4fr_1fr_.8fr_.8fr_1.2fr] gap-4 border-b border-border bg-[#e7e3d8] px-5 py-3 font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground md:grid"><span>Συνεργάτης</span><span>Όχημα</span><span>Εμπειρία</span><span>Φάκελος</span><span>Ενέργεια</span></div>{(drivers.data ?? []).map((driver) => <DriverRow key={driver.id} driver={driver} busy={busyId === driver.id} onDecide={decide} documents={(documents.data ?? []).filter((doc) => doc.driverId === driver.id)} reviewingDocumentId={reviewingDocumentId} onDecideDocument={decideDocument} />)}</div>}</section>
  </div></div>;
}

function BookingRow({ booking }: { booking: Booking }) {
  return <article className="rounded-2xl border border-[#d8d5cc] bg-card p-4 md:p-5" data-testid={`row-booking-${booking.id}`}><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-2xl text-primary">{booking.title}</h3><StatusPill status={booking.status} /></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {formatDate(booking.date)}</span><span className="inline-flex items-center gap-1"><Clock3 size={13} /> {booking.time ?? 'Ώρα σε επιβεβαίωση'}</span><span className="inline-flex items-center gap-1"><MapPin size={13} /> {booking.pickup}</span><span className="inline-flex items-center gap-1"><Users size={13} /> {booking.passengers} άτομα</span></div></div><div className="flex flex-wrap items-center gap-5 text-sm"><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Πελάτης</p><p className="font-semibold text-primary">{booking.customerName ?? 'Χωρίς όνομα'}</p><p className="text-xs text-muted-foreground">{booking.customerPhone ?? 'Χωρίς κινητό'}</p></div><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Οδηγός</p><p className="font-semibold text-primary">{booking.driverName ?? 'Αναμένεται'}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Σύνολο</p><p className="font-display text-xl text-primary">{formatEuro(booking.total)}</p></div></div></div></article>;
}

function DriverRow({ driver, busy, onDecide, documents, reviewingDocumentId, onDecideDocument }: { driver: Driver; busy: boolean; onDecide: (driver: Driver, status: 'approved' | 'rejected') => void; documents: DriverDocument[]; reviewingDocumentId: string | null; onDecideDocument: (document: DriverDocument, status: 'approved' | 'rejected') => void }) {
  const [open, setOpen] = useState(false);
  return <div className="border-b border-border p-5 last:border-b-0" data-testid={`row-driver-${driver.id}`}><div className="grid gap-4 md:grid-cols-[1.4fr_1fr_.8fr_.8fr_1.2fr] md:items-center"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#f2bf91] font-display text-sm text-primary">{driver.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><p className="font-bold text-primary">{driver.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} />{driver.city}</p></div></div><div><p className="text-sm font-semibold text-primary">{driver.vehicle}</p><p className="mt-1 text-xs text-muted-foreground">{driver.vehicleType}</p></div><div className="flex items-center gap-1 text-sm text-primary"><Star size={14} className="text-accent" fill="currentColor" /> {driver.rating.toFixed(2)}<span className="ml-1 text-xs text-muted-foreground">· {driver.trips} trips</span></div><button data-testid={`button-documents-${driver.id}`} onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-bold text-primary hover:text-accent"><FileText size={16} /> {documents.length} αρχεία</button><div className="flex gap-2">{driver.status === 'pending' ? <><ActionButton data-testid={`button-approve-driver-${driver.id}`} onClick={() => onDecide(driver, 'approved')} disabled={busy} loading={busy} className="bg-[#32795d] px-3 py-2 text-xs hover:bg-[#276349]"><Check size={14} /> Έγκριση</ActionButton><button data-testid={`button-reject-driver-${driver.id}`} onClick={() => onDecide(driver, 'rejected')} disabled={busy} className="grid h-9 w-9 place-items-center rounded-xl border border-[#e5b2aa] text-[#a24d43] hover:bg-[#fff3f0]"><X size={16} /></button></> : <StatusPill status={driver.status} />}</div></div>{open && <div className="mt-4 rounded-xl bg-muted/60 p-4 text-xs text-muted-foreground" data-testid={`details-driver-${driver.id}`}><p className="mb-3 font-bold text-primary">Έγγραφα προς επαλήθευση</p>{documents.length === 0 ? <p>Δεν έχει ανεβάσει ακόμα έγγραφα.</p> : <ul className="space-y-2">{documents.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2" data-testid={`row-document-${document.id}`}><a href={`/api/storage/objects/${document.objectPath.replace(/^\/?objects\//, '')}`} target="_blank" rel="noreferrer" data-testid={`link-view-document-${document.id}`} className="font-semibold text-primary underline decoration-dotted hover:text-accent">{document.fileName}</a><div className="flex items-center gap-2">{document.status === 'pending' ? <><button data-testid={`button-approve-document-${document.id}`} onClick={() => onDecideDocument(document, 'approved')} disabled={reviewingDocumentId === document.id} className="rounded-lg bg-[#32795d] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#276349] disabled:opacity-60">Έγκριση</button><button data-testid={`button-reject-document-${document.id}`} onClick={() => onDecideDocument(document, 'rejected')} disabled={reviewingDocumentId === document.id} className="rounded-lg border border-[#e5b2aa] px-2.5 py-1.5 text-[11px] font-bold text-[#a24d43] hover:bg-[#fff3f0] disabled:opacity-60">Απόρριψη</button></> : <StatusPill status={document.status} />}</div></li>)}</ul>}</div>}</div>;
}
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useUser } from '@clerk/react';
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Clock3, MapPin, SlidersHorizontal, Star, Users, X } from 'lucide-react';
import { useCreateBooking, useCreateQuote, useGetExperience, useListExperiences, getGetExperienceQueryKey, getListExperiencesQueryKey, getListBookingsQueryKey, getGetDashboardSummaryQueryKey } from '@workspace/api-client-react';
import type { Experience, Quote, QuoteInput } from '@workspace/api-client-react';
import { ActionButton, DataTag, EmptyState, ErrorState, formatEuro, LoadingState, PageIntro, SuccessNotice } from '@/components/travel-ui';
import { useQueryClient } from '@tanstack/react-query';
import heroImage from '../../attached_assets/aperion-hero.jpg';

type BookingSelection = Experience & {
  bookingDate: string;
  bookingTime: string;
  bookingPassengers: number;
  bookingPickup: string;
  bookingStops: string[];
};

function formatBookingDate(value: string) {
  return new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function ExperienceCard({ experience, onBook }: { experience: Experience; onBook: (experience: Experience) => void }) {
  return (
    <article className="lift-card group overflow-hidden rounded-2xl border border-border bg-card transition-transform" data-testid={`card-experience-${experience.id}`}>
      <div className="relative h-52 overflow-hidden">
        <img data-testid={`img-experience-${experience.id}`} src={experience.imageUrl || heroImage} alt={experience.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute left-4 top-4 rounded-full bg-[#fbf4e7]/90 px-3 py-1 font-mono-ui text-[10px] uppercase tracking-wider text-primary">{experience.category}</span>
        <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-primary/85 px-2.5 py-1 text-xs text-[#fbf4e7]"><Star size={12} fill="currentColor" /> {experience.rating.toFixed(1)}</span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3"><h3 className="font-display text-[23px] leading-tight text-primary">{experience.title}</h3><span className="whitespace-nowrap font-mono-ui text-xs text-accent">από {formatEuro(experience.priceFrom)}</span></div>
        <div className="mt-3 flex gap-4"><DataTag>{experience.location}</DataTag><DataTag icon={Clock3}>{experience.durationHours} ώρες</DataTag></div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{experience.description}</p>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4"><span className="text-xs text-muted-foreground">{experience.reviewCount} αξιολογήσεις</span><button data-testid={`button-book-experience-${experience.id}`} onClick={() => onBook(experience)} className="group/btn inline-flex items-center gap-1 text-sm font-bold text-primary hover:text-accent">Κράτηση <ArrowRight size={15} className="transition-transform group-hover/btn:translate-x-1" /></button></div>
      </div>
    </article>
  );
}

const GREEK_WEEKDAYS = ['κυριακή', 'δευτέρα', 'τρίτη', 'τετάρτη', 'πέμπτη', 'παρασκευή', 'σάββατο'];
const GREEK_MONTHS = ['ιανουαρίου', 'φεβρουαρίου', 'μαρτίου', 'απριλίου', 'μαΐου', 'ιουνίου', 'ιουλίου', 'αυγούστου', 'σεπτεμβρίου', 'οκτωβρίου', 'νοεμβρίου', 'δεκεμβρίου'];
const greekWord = (word: string) => new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, 'u');

function parseFreeTextBooking(text: string, now: Date) {
  const lower = text.toLowerCase();
  const result: { date?: string; startTime?: string; durationHours?: string; passengers?: string } = {};

  const toISODate = (d: Date) => d.toISOString().slice(0, 10);
  if (greekWord('σήμερα').test(lower)) result.date = toISODate(now);
  else if (greekWord('αύριο').test(lower)) result.date = toISODate(new Date(now.getTime() + 86400000));
  else if (greekWord('μεθαύριο').test(lower)) result.date = toISODate(new Date(now.getTime() + 2 * 86400000));
  else {
    const dmMatch = lower.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);
    const dMonthMatch = lower.match(/\b(\d{1,2})\s+(ιανουαρίου|φεβρουαρίου|μαρτίου|απριλίου|μαΐου|ιουνίου|ιουλίου|αυγούστου|σεπτεμβρίου|οκτωβρίου|νοεμβρίου|δεκεμβρίου)(?!\p{L})/u);
    if (dmMatch) {
      const day = Number(dmMatch[1]);
      const month = Number(dmMatch[2]) - 1;
      const year = dmMatch[3] ? (dmMatch[3].length === 2 ? 2000 + Number(dmMatch[3]) : Number(dmMatch[3])) : now.getFullYear();
      result.date = toISODate(new Date(year, month, day, 12));
    } else if (dMonthMatch) {
      const day = Number(dMonthMatch[1]);
      const month = GREEK_MONTHS.indexOf(dMonthMatch[2]);
      result.date = toISODate(new Date(now.getFullYear(), month, day, 12));
    } else {
      const weekdayIndex = GREEK_WEEKDAYS.findIndex((w) => greekWord(w).test(lower));
      if (weekdayIndex >= 0) {
        const currentDay = now.getDay();
        let diff = weekdayIndex - currentDay;
        if (diff <= 0) diff += 7;
        result.date = toISODate(new Date(now.getTime() + diff * 86400000));
      }
    }
  }

  const timeMatch = lower.match(/\b(\d{1,2})[:.](\d{2})\b/) ?? lower.match(/(?<!\p{L})(?:στις|ώρα)\s*(\d{1,2})(?!\d)/u);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    if (greekWord('απόγευμα').test(lower) || greekWord('βράδυ').test(lower)) { if (hour < 12) hour += 12; }
    result.startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const durationMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:ώρες|ώρα|ωρών)/);
  if (durationMatch) result.durationHours = String(Number(durationMatch[1].replace(',', '.')));
  else if (/ολοήμερ|όλη\s+τη\s+μέρα/.test(lower)) result.durationHours = '8';
  else if (/μισή\s+μέρα/.test(lower)) result.durationHours = '4';

  const passengersMatch = lower.match(/(\d+)\s*(?:άτομα|άτομο|επιβάτ\w*|άνθρωποι|ανθρώπους)/);
  if (passengersMatch) result.passengers = passengersMatch[1];

  return result;
}

type GeoPoint = { lat: number; lng: number };

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

async function searchAddress(query: string): Promise<{ label: string; point: GeoPoint }[]> {
  if (query.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=el&countrycodes=gr`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const results: NominatimResult[] = await res.json();
  return results.map((r) => ({ label: r.display_name, point: { lat: Number(r.lat), lng: Number(r.lon) } }));
}

async function fetchRealDistanceKm(points: GeoPoint[]): Promise<number | null> {
  if (points.length < 2) return null;
  const coordsPath = points.map((p) => `${p.lng},${p.lat}`).join(';');
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsPath}?overview=false`);
    if (!res.ok) return null;
    const data = await res.json();
    const meters = data?.routes?.[0]?.distance;
    return typeof meters === 'number' ? Math.round((meters / 1000) * 10) / 10 : null;
  } catch {
    return null;
  }
}

function AddressField({ value, onChange, onSelectPoint, placeholder, testId }: { value: string; onChange: (text: string) => void; onSelectPoint: (point: GeoPoint | null) => void; placeholder?: string; testId: string }) {
  const [suggestions, setSuggestions] = useState<{ label: string; point: GeoPoint }[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await searchAddress(value);
      setSuggestions(results);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  return (
    <div className="relative flex-1">
      <input
        data-testid={testId}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); onSelectPoint(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="field-dark w-full"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl bg-card text-left shadow-xl">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                data-testid={`${testId}-suggestion-${i}`}
                onMouseDown={() => { onChange(s.label); onSelectPoint(s.point); setOpen(false); }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-primary hover:bg-muted"
              >
                <MapPin size={13} className="mt-0.5 shrink-0 text-accent" />
                <span className="line-clamp-2">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuotePanel({ onQuote }: { onQuote: (quote: Quote, input: QuoteInput, freeText: string) => void }) {
  const createQuote = useCreateQuote();
  const [freeText, setFreeText] = useState('');
  const [parsedFields, setParsedFields] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ pickup: 'Ξενοδοχείο Ακτή, Αθήνα', date: '2026-09-15', startTime: '09:30', durationHours: '8', passengers: '4', vehicleType: 'van' as QuoteInput['vehicleType'] });
  const [pickupPoint, setPickupPoint] = useState<GeoPoint | null>(null);
  const [stops, setStops] = useState<string[]>(['Ναύπλιο']);
  const [stopPoints, setStopPoints] = useState<Record<number, GeoPoint | null>>({});
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'real' | 'estimate'>('idle');
  const updateStop = (index: number, value: string) => setStops((prev) => prev.map((stop, i) => (i === index ? value : stop)));
  const setStopPoint = (index: number, point: GeoPoint | null) => setStopPoints((prev) => ({ ...prev, [index]: point }));
  const addStop = () => setStops((prev) => [...prev, '']);
  const removeStop = (index: number) => { setStops((prev) => prev.filter((_, i) => i !== index)); setStopPoints((prev) => { const next = { ...prev }; delete next[index]; return next; }); };
  const applyFreeText = () => {
    const parsed = parseFreeTextBooking(freeText, new Date());
    setForm((prev) => ({ ...prev, ...parsed }));
    setParsedFields(new Set(Object.keys(parsed)));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanStops = stops.map((s) => s.trim()).filter(Boolean);
    const input: QuoteInput = { ...form, stops: cleanStops, durationHours: Number(form.durationHours), passengers: Number(form.passengers) };

    const routePoints = [pickupPoint, ...stops.map((_, i) => stopPoints[i] ?? null)].filter((p): p is GeoPoint => p !== null);
    let realDistanceKm: number | undefined;
    if (pickupPoint && routePoints.length === cleanStops.length + 1) {
      setRouteStatus('loading');
      const distance = await fetchRealDistanceKm(routePoints);
      if (distance) { input.realDistanceKm = distance; realDistanceKm = distance; setRouteStatus('real'); } else setRouteStatus('estimate');
    } else setRouteStatus('estimate');

    createQuote.mutate({ data: input }, { onSuccess: (quote) => onQuote(quote, input, freeText) });
  };
  return (
    <form onSubmit={submit} className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl md:p-8" data-testid="form-quote">
      <div className="flex items-start justify-between gap-4"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-accent">Φτιάξε τη δική σου μέρα</p><h2 className="mt-2 font-display text-3xl leading-tight">Από πόρτα σε πόρτα,<br />χωρίς πρόγραμμα-παζλ.</h2></div><SlidersHorizontal className="text-accent" /></div>
      <div className="mt-6 rounded-2xl bg-white/10 p-4"><label><span className="field-label text-primary-foreground/80">Περιέγραψε τη διαδρομή σου ελεύθερα (προαιρετικό)</span><textarea data-testid="input-free-text-booking" rows={2} value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="π.χ. Αύριο στις 10 το πρωί, 4 άτομα, θέλουμε περίπου 6 ώρες με στάση στο Ναύπλιο" className="field-dark w-full resize-none" /></label><button type="button" data-testid="button-apply-free-text" onClick={applyFreeText} disabled={!freeText.trim()} className="mt-2 text-xs font-bold text-accent hover:underline disabled:opacity-40">Συμπλήρωσε αυτόματα τα στοιχεία παρακάτω →</button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="field-label">Σημείο παραλαβής</span><AddressField testId="input-quote-pickup" value={form.pickup} onChange={(text) => setForm({ ...form, pickup: text })} onSelectPoint={setPickupPoint} /></label>
        <div className="sm:col-span-2">
          <span className="field-label">Στάσεις / προορισμός</span>
          <div className="mt-1 space-y-2">
            {stops.map((stop, index) => (
              <div key={index} className="flex gap-2">
                <AddressField testId={`input-quote-stop-${index}`} placeholder={index === stops.length - 1 ? 'Τελικός προορισμός' : `Στάση ${index + 1}`} value={stop} onChange={(text) => updateStop(index, text)} onSelectPoint={(point) => setStopPoint(index, point)} />
                {stops.length > 1 && <button type="button" data-testid={`button-remove-stop-${index}`} onClick={() => removeStop(index)} className="rounded-xl border border-white/20 px-3 text-sm text-primary-foreground/80 hover:bg-white/10">×</button>}
              </div>
            ))}
          </div>
          <button type="button" data-testid="button-add-stop" onClick={addStop} className="mt-2 text-xs font-bold text-accent hover:underline">+ Προσθήκη στάσης</button>
        </div>
        <label><span className="field-label">Ημερομηνία {parsedFields.has('date') && <span className="text-accent">✓ αυτόματα</span>}</span><input data-testid="input-quote-date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="field-dark" /></label>
        <label><span className="field-label">Ώρα εκκίνησης {parsedFields.has('startTime') && <span className="text-accent">✓ αυτόματα</span>}</span><input data-testid="input-quote-time" type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="field-dark" /></label>
        <label><span className="field-label">Διάρκεια {parsedFields.has('durationHours') && <span className="text-accent">✓ αυτόματα</span>}</span><select data-testid="select-quote-duration" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })} className="field-dark"><option value="4">4 ώρες</option><option value="6">6 ώρες</option><option value="8">8 ώρες</option><option value="10">10 ώρες</option></select></label>
        <label><span className="field-label">Άτομα {parsedFields.has('passengers') && <span className="text-accent">✓ αυτόματα</span>}</span><select data-testid="select-quote-passengers" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: e.target.value })} className="field-dark"><option value="2">2 άτομα</option><option value="4">4 άτομα</option><option value="6">6 άτομα</option><option value="8">8 άτομα</option></select></label>
        <label><span className="field-label">Όχημα</span><select data-testid="select-quote-vehicle" value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value as QuoteInput['vehicleType'] })} className="field-dark"><option value="sedan">Sedan</option><option value="van">Van</option><option value="minibus">Minibus</option><option value="bus">Bus</option></select></label>
      </div>
      <ActionButton type="submit" loading={createQuote.isPending || routeStatus === 'loading'} className="mt-6 w-full bg-accent text-primary hover:bg-[#f6c995]">{routeStatus === 'loading' ? 'Υπολογίζουμε την πραγματική διαδρομή…' : 'Υπολόγισε την τιμή'} <ArrowRight size={16} /></ActionButton>
      {createQuote.isError && <p className="mt-3 text-xs text-[#f6c995]" data-testid="text-quote-error">Δεν μπορέσαμε να υπολογίσουμε τη διαδρομή. Έλεγξε τα στοιχεία σου.</p>}
    </form>
  );
}

export default function Home() {
  const { user } = useUser();
  const { data: experiences, isLoading, isError, refetch } = useListExperiences({ query: { queryKey: getListExperiencesQueryKey(), staleTime: 300_000 } });
  const createBooking = useCreateBooking();
  const queryClient = useQueryClient();
  const [quote, setQuote] = useState<{ result: Quote; input: QuoteInput; freeText: string } | null>(null);
  const [selected, setSelected] = useState<BookingSelection | null>(null);
  const [bookingDone, setBookingDone] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Όλα');
  const categories = useMemo(() => ['Όλα', ...Array.from(new Set((experiences ?? []).map((e) => e.category)))], [experiences]);
  const selectedDetails = useGetExperience(selected?.id ?? '', { query: { enabled: Boolean(selected?.id), queryKey: getGetExperienceQueryKey(selected?.id ?? ''), staleTime: 300_000 } });
  const visible = (experiences ?? []).filter((e) => category === 'Όλα' || e.category === category);

  const bookExperience = (experience: Experience) => {
    setSelected({ ...experience, bookingDate: '2026-09-15', bookingTime: '09:30', bookingPassengers: 2, bookingPickup: 'Ξενοδοχείο Ακτή, Αθήνα', bookingStops: [] });
    setCustomerName(user?.fullName ?? '');
    setCustomerPhone(user?.primaryPhoneNumber?.phoneNumber ?? '');
    setNotes('');
    setBookingDone(false);
  };

  const submitBooking = () => {
    if (!selected) return;
    const active = selectedDetails.data ?? selected;
    createBooking.mutate({
      data: {
        customerId: user?.id,
        experienceId: active.id || undefined,
        title: active.title,
        date: selected.bookingDate,
        time: selected.bookingTime,
        passengers: selected.bookingPassengers,
        pickup: selected.bookingPickup,
        stops: selected.bookingStops,
        customerName,
        customerPhone,
        notes: notes.trim() || undefined,
        destination: selected.bookingStops[selected.bookingStops.length - 1] ?? active.location,
        vehicleType: 'van',
        total: active.priceFrom,
      },
    }, {
      onSuccess: () => {
        setBookingDone(true);
        if (user) {
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey({ customerId: user.id }) });
        }
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };

  return (
    <div className="sunset-wash">
      <section className="relative overflow-hidden px-5 pb-14 pt-12 md:px-10 md:pb-20 md:pt-20">
        <div className="mx-auto grid max-w-[1280px] items-end gap-12 lg:grid-cols-[1.02fr_.98fr]">
          <div className="reveal"><p className="font-mono-ui text-[10px] uppercase tracking-[.26em] text-accent">Αθήνα · Κυκλάδες · Πελοπόννησος</p><h1 data-testid="text-home-heading" className="mt-5 max-w-2xl font-display text-[54px] leading-[.94] tracking-[-.045em] text-primary sm:text-7xl lg:text-[88px]">Η μέρα σου,<br /><em className="text-[#c96c4c]">όπως πρέπει</em><br />να είναι.</h1><p className="mt-7 max-w-md text-base leading-7 text-muted-foreground">Μετακίνηση που γίνεται ανάμνηση. Διάλεξε μια έτοιμη διαδρομή ή άφησέ μας να ενώσουμε τα σημεία που θέλεις να θυμάσαι.</p><div className="mt-8 flex flex-wrap gap-3"><a data-testid="link-scroll-experiences" href="#experiences" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:-translate-y-0.5">Δες εμπειρίες <ArrowRight size={16} /></a><a data-testid="link-scroll-quote" href="#custom" className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-card/60 px-5 py-3 text-sm font-bold text-primary hover:border-accent">Φτιάξε τη δική σου</a></div></div>
          <div className="reveal reveal-delay-2 relative min-h-[385px] overflow-hidden rounded-[32px] bg-[#d67c5a] shadow-2xl"><img src={heroImage} alt="Παραθαλάσσια διαδρομή με θέα" className="absolute inset-0 h-full w-full object-cover mix-blend-multiply opacity-75" /><div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-[#e6a07d]/20" /><div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-[#fbf4e7]"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-accent">Σημερινή έμπνευση</p><p className="mt-1 font-display text-3xl">Το Ναύπλιο σε μία μέρα</p></div><span className="grid h-12 w-12 place-items-center rounded-full border border-[#fbf4e7]/40"><ArrowUpRight size={20} /></span></div></div>
        </div>
      </section>

      <section id="experiences" className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 md:py-20">
        <PageIntro eyebrow="Επιλεγμένες διαδρομές" title="Μικρές αποδράσεις, μεγάλη αίσθηση." detail="Σχεδιασμένες από ανθρώπους που ξέρουν πού αξίζει να σταθείς — και πότε να μην κοιτάξεις το ρολόι." action={<div className="flex gap-2 overflow-x-auto">{categories.map((item) => <button key={item} data-testid={`button-category-${item}`} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold ${category === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary'}`}>{item}</button>)}</div>} />
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={() => refetch()} /> : visible.length === 0 ? <EmptyState title="Η επόμενη διαδρομή ξεκινά εδώ." detail="Δεν βρήκαμε εμπειρίες σε αυτή την κατηγορία. Δοκίμασε το «Όλα» ή σχεδίασε τη δική σου μέρα." /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map((experience, index) => <div key={experience.id} className={`reveal reveal-delay-${Math.min(index + 1, 3)}`}><ExperienceCard experience={experience} onBook={bookExperience} /></div>)}</div>}
      </section>

      <section id="custom" className="border-y border-primary/10 bg-[#e7ded0] px-5 py-14 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <div><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-accent">Custom, αλλά απλό</p><h2 className="mt-3 max-w-md font-display text-5xl leading-[.98] text-primary">Τα σημεία σου.<br /><em className="text-[#c96c4c]">Ο ρυθμός σου.</em></h2><p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">Πες μας από πού ξεκινάς, τι θέλεις να δεις και πόσο χρόνο έχεις. Η τιμή εμφανίζεται πριν αποφασίσεις.</p><div className="mt-8 grid max-w-md gap-3 sm:grid-cols-3"><div><span className="font-display text-2xl text-primary">01</span><p className="mt-1 text-xs leading-5 text-muted-foreground">Συμπληρώνεις τη διαδρομή</p></div><div><span className="font-display text-2xl text-primary">02</span><p className="mt-1 text-xs leading-5 text-muted-foreground">Βλέπεις καθαρή τιμή</p></div><div><span className="font-display text-2xl text-primary">03</span><p className="mt-1 text-xs leading-5 text-muted-foreground">Κλείνεις χωρίς άγχος</p></div></div></div>
          <QuotePanel onQuote={(result, input, freeText) => setQuote({ result, input, freeText })} />
        </div>
      </section>

       {quote && <div className="fixed inset-0 z-50 grid place-items-center bg-primary/50 p-5 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl bg-card p-7 shadow-2xl" data-testid="dialog-quote-result"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-accent">Η εκτίμησή σου</p><h2 className="mt-2 font-display text-4xl text-primary">{formatEuro(quote.result.total)}</h2><p className="mt-1 text-sm text-muted-foreground">{quote.result.distanceKm} χλμ · {quote.result.durationHours} ώρες · {quote.input.passengers} άτομα</p></div><button data-testid="button-close-quote" onClick={() => setQuote(null)} className="text-muted-foreground hover:text-primary">×</button></div><div className="mt-6 space-y-3 border-y border-border py-5">{quote.result.breakdown.map((line) => <div key={line.label} className="flex justify-between text-sm"><span className="text-muted-foreground">{line.label}</span><span className="font-semibold">{formatEuro(line.amount)}</span></div>)}<div className="flex justify-between pt-2 text-sm font-bold text-primary"><span>Προκαταβολή</span><span>{formatEuro(quote.result.deposit)}</span></div></div><ActionButton data-testid="button-quote-book" onClick={() => { setQuote(null); setSelected({ id: '', title: `Custom διαδρομή · ${quote.input.pickup}`, location: quote.input.stops[quote.input.stops.length - 1] ?? quote.input.pickup, durationHours: quote.result.durationHours, priceFrom: quote.result.total, category: 'Custom', description: '', imageUrl: '', highlights: [], rating: 0, reviewCount: 0, bookingDate: quote.input.date, bookingTime: quote.input.startTime, bookingPassengers: quote.input.passengers, bookingPickup: quote.input.pickup, bookingStops: quote.input.stops }); setCustomerName(user?.fullName ?? ''); setCustomerPhone(user?.primaryPhoneNumber?.phoneNumber ?? ''); setNotes(quote.freeText); setBookingDone(false); }}>Συνέχισε στην κράτηση <ArrowRight size={16} /></ActionButton></div></div>}

       {selected && <div onClick={() => setSelected(null)} className="fixed inset-0 z-50 grid place-items-center bg-primary/50 p-5 backdrop-blur-sm"><div onClick={(event) => event.stopPropagation()} className="relative w-full max-w-md rounded-3xl bg-card p-7 shadow-2xl" data-testid="dialog-booking"><button data-testid="button-close-booking-dialog" onClick={() => setSelected(null)} aria-label="Κλείσιμο" className="absolute right-5 top-5 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><X size={18} /></button><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-accent">Τελικό βήμα</p><h2 className="mt-2 pr-8 font-display text-3xl text-primary">{selected.title}</h2>{bookingDone ? <div className="mt-6"><SuccessNotice>Το αίτημα κράτησης καταχωρήθηκε. Θα ενημερωθείς στο κινητό σου όταν ανατεθεί οδηγός.</SuccessNotice>{user ? <Link href="/bookings" data-testid="link-view-bookings" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">Δες τις κρατήσεις <ChevronRight size={15} /></Link> : <p className="mt-5 text-xs leading-5 text-muted-foreground">Κράτησες ως επισκέπτης, οπότε δεν κρατάμε ιστορικό κρατήσεων. Αν θες να βλέπεις τις επόμενες κρατήσεις σου, <Link href="/sign-in" className="font-bold text-primary underline">συνδέσου ή δημιούργησε λογαριασμό</Link>.</p>}<button data-testid="button-close-booking-done" onClick={() => setSelected(null)} className="mt-6 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">Επιστροφή στην αρχική</button></div> : <><div className="mt-5 space-y-3 rounded-2xl bg-muted/60 p-4 text-sm"><DataTag icon={CalendarDays}>{formatBookingDate(selected.bookingDate)} · {selected.bookingTime}</DataTag><DataTag icon={Users}>{selected.bookingPassengers} επιβάτες</DataTag><DataTag icon={Clock3}>{selected.bookingPickup}</DataTag>{selected.bookingStops.length > 0 && <DataTag icon={ChevronRight}>{selected.bookingStops.join(' → ')}</DataTag>}<div className="flex justify-between border-t border-border pt-3"><span className="text-muted-foreground">Σύνολο</span><strong>{formatEuro(selected.priceFrom)}</strong></div></div>{!user && <label className="mt-4 block"><span className="field-label-dark">Ονοματεπώνυμο</span><input data-testid="input-booking-name" required value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="π.χ. Μαρία Παπαδοπούλου" className="field-light" /></label>}<label className="mt-4 block"><span className="field-label-dark">Κινητό για WhatsApp / Viber</span><input data-testid="input-booking-phone" type="tel" required value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+30 69X XXX XXXX" className="field-light" /></label><label className="mt-4 block"><span className="field-label-dark">Πες μας ελεύθερα τι θέλεις (προαιρετικό)</span><textarea data-testid="input-booking-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="π.χ. Θέλω να περάσουμε από 3 χωριά, με στάση 1 ώρα σε καθένα, γύρω στις 6 ώρες συνολικά…" className="field-light w-full resize-none" /></label><p className="mt-3 text-xs leading-5 text-muted-foreground">Η πληρωμή θα προστεθεί σε επόμενο βήμα. Προς το παρόν κρατάμε το αίτημά σου και τα στοιχεία επικοινωνίας. {!user && 'Κάνεις κράτηση ως επισκέπτης — χωρίς λογαριασμό δεν θα μπορείς να δεις ιστορικό κρατήσεων αργότερα.'}</p><ActionButton data-testid="button-confirm-booking" onClick={submitBooking} loading={createBooking.isPending} className="mt-5 w-full">Καταχώρησε αίτημα κράτησης <ArrowRight size={16} /></ActionButton>{createBooking.isError && <p className="mt-3 text-xs text-[#b24d42]" data-testid="text-booking-error">Η κράτηση δεν ολοκληρώθηκε. Έλεγξε τα στοιχεία σου και προσπάθησε ξανά.</p>}<button data-testid="button-cancel-booking" onClick={() => setSelected(null)} className="mt-3 w-full py-2 text-sm text-muted-foreground hover:text-primary">Πίσω</button></>}</div></div>}
    </div>
  );
}
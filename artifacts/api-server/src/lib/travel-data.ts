import { db, bookingsTable, driverJobsTable, driversTable, experiencesTable, pricingSettingsTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";

export const seededExperiences = [
  {
    id: "naousa-sunset",
    title: "Ηλιοβασίλεμα στη Νάουσα",
    location: "Πάρος",
    durationHours: 5,
    priceFrom: 185,
    category: "Sunset & wine",
    description: "Απογευματινή διαδρομή με ιδιωτικό van, κρασί και τα πιο όμορφα σημεία της Πάρου.",
    imageUrl: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=85",
    highlights: ["Ιδιωτική μεταφορά", "Τοπική γευσιγνωσία", "Golden hour στάση"],
    rating: 4.9,
    reviewCount: 128,
  },
  {
    id: "antiparos-escape",
    title: "Απόδραση στην Αντίπαρο",
    location: "Κυκλάδες",
    durationHours: 8,
    priceFrom: 320,
    category: "Beach day",
    description: "Μια ολοήμερη εξερεύνηση με άνεση, ευελιξία και χρόνο για τις αγαπημένες σου παραλίες.",
    imageUrl: "https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1200&q=85",
    highlights: ["Island hopping", "Beach stops", "Ευέλικτο πρόγραμμα"],
    rating: 4.8,
    reviewCount: 94,
  },
  {
    id: "paros-villages",
    title: "Χωριά & γεύσεις της Πάρου",
    location: "Πάρος",
    durationHours: 6,
    priceFrom: 240,
    category: "Local culture",
    description: "Περιήγηση στα λευκά χωριά του νησιού με στάσεις για αυθεντικές τοπικές γεύσεις.",
    imageUrl: "https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?auto=format&fit=crop&w=1200&q=85",
    highlights: ["Λεύκες & Πρόδρομος", "Local food stops", "Ιστορίες από ντόπιους"],
    rating: 5,
    reviewCount: 76,
  },
];

export const seededJobs = [
  {
    id: "job-airport-parikia",
    title: "Αεροδρόμιο → Παροικιά",
    scheduledDate: "2026-09-12",
    time: "10:30",
    pickup: "Αεροδρόμιο Πάρου",
    destination: "Paros Bay Hotel",
    passengers: 4,
    vehicleType: "van",
    payout: 68,
    distanceKm: 11,
    status: "open",
    isCustom: 0,
  },
  {
    id: "job-sunset-naousa",
    title: "Ηλιοβασίλεμα στη Νάουσα",
    scheduledDate: "2026-09-12",
    time: "17:00",
    pickup: "Parikia Port",
    destination: "Naousa & Kolymbithres",
    passengers: 6,
    vehicleType: "van",
    payout: 156,
    distanceKm: 42,
    status: "open",
    isCustom: 0,
  },
  {
    id: "job-custom-family",
    title: "Custom: Οικογενειακή ημέρα",
    scheduledDate: "2026-09-14",
    time: "09:00",
    pickup: "Aliki",
    destination: "Νότια Πάρος",
    passengers: 8,
    vehicleType: "minibus",
    payout: 212,
    distanceKm: 64,
    status: "open",
    isCustom: 1,
  },
];

export async function getPricingSettings() {
  const [row] = await db.select().from(pricingSettingsTable).where(eq(pricingSettingsTable.id, "default"));
  return row ?? defaultPricingSettings;
}

export async function ensureTravelSeed(): Promise<void> {
  const [{ value: experienceCount }] = await db
    .select({ value: count() })
    .from(experiencesTable);
  if (Number(experienceCount) === 0) {
    await db.insert(experiencesTable).values(seededExperiences);
  }

  const [{ value: pricingCount }] = await db
    .select({ value: count() })
    .from(pricingSettingsTable);
  if (Number(pricingCount) === 0) {
    await db.insert(pricingSettingsTable).values(defaultPricingSettings);
  }

  const [{ value: jobCount }] = await db
    .select({ value: count() })
    .from(driverJobsTable);
  if (Number(jobCount) === 0) {
    await db.insert(driverJobsTable).values(seededJobs);
  }

  const [{ value: driverCount }] = await db
    .select({ value: count() })
    .from(driversTable);
  if (Number(driverCount) === 0) {
    await db.insert(driversTable).values([
      {
        id: "driver-nikos",
        name: "Νίκος Παπαδόπουλος",
        city: "Πάρος",
        vehicle: "Mercedes V-Class",
        vehicleType: "van",
        rating: 4.9,
        trips: 342,
        status: "approved",
        documents: 5,
      },
      {
        id: "driver-maria",
        name: "Μαρία Γεωργίου",
        city: "Νάξος",
        vehicle: "Toyota Proace",
        vehicleType: "van",
        rating: 4.8,
        trips: 187,
        status: "pending",
        documents: 4,
      },
      {
        id: "driver-andreas",
        name: "Ανδρέας Κωνσταντίνου",
        city: "Πάρος",
        vehicle: "Iveco Daily",
        vehicleType: "minibus",
        rating: 4.7,
        trips: 96,
        status: "pending",
        documents: 3,
      },
    ]);
  }

  const [{ value: bookingCount }] = await db
    .select({ value: count() })
    .from(bookingsTable);
  if (Number(bookingCount) === 0) {
    await db.insert(bookingsTable).values([
      {
        id: "booking-sunset",
        customerId: "demo-customer",
        experienceId: "naousa-sunset",
        title: "Ηλιοβασίλεμα στη Νάουσα",
        scheduledDate: "2026-09-12",
        pickup: "Paros Bay Hotel",
        passengers: 4,
        total: 222,
        paid: 66.6,
        status: "confirmed",
        driverName: "Νίκος Παπαδόπουλος",
        vehicle: "Mercedes V-Class",
      },
      {
        id: "booking-villages",
        customerId: "demo-customer",
        experienceId: "paros-villages",
        title: "Χωριά & γεύσεις της Πάρου",
        scheduledDate: "2026-09-20",
        pickup: "Parikia Port",
        passengers: 2,
        total: 288,
        paid: 288,
        status: "pending",
        driverName: null,
        vehicle: null,
      },
    ]);
  }
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const defaultPricingSettings = {
  id: "default",
  baseRate: 42,
  kmRate: 1.35,
  hourlyRate: 22,
  vehicleMultiplierSedan: 1,
  vehicleMultiplierVan: 1.35,
  vehicleMultiplierMinibus: 1.7,
  vehicleMultiplierBus: 2.25,
  freePassengers: 4,
  extraPassengerRate: 8,
  platformFeePercent: 0.18,
};

export function calculateQuote(
  input: {
    stops: string[];
    durationHours: number;
    passengers: number;
    vehicleType: "sedan" | "van" | "minibus" | "bus";
  },
  pricing: typeof defaultPricingSettings,
) {
  const distanceKm = Math.max(18, 12 + input.stops.length * 18 + input.durationHours * 5);
  const vehicleMultiplier = {
    sedan: pricing.vehicleMultiplierSedan,
    van: pricing.vehicleMultiplierVan,
    minibus: pricing.vehicleMultiplierMinibus,
    bus: pricing.vehicleMultiplierBus,
  }[input.vehicleType];
  const base = pricing.baseRate;
  const distance = distanceKm * pricing.kmRate;
  const hours = input.durationHours * pricing.hourlyRate;
  const passengerAdjustment = Math.max(0, input.passengers - pricing.freePassengers) * pricing.extraPassengerRate;
  const subtotal = Math.round((base + distance + hours + passengerAdjustment) * vehicleMultiplier);
  const platformFee = Math.round(subtotal * pricing.platformFeePercent);
  const total = subtotal + platformFee;

  return {
    id: `quote-${Date.now()}`,
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationHours: input.durationHours,
    subtotal,
    platformFee,
    total,
    deposit: Math.round(total * 0.3 * 100) / 100,
    currency: "EUR",
    breakdown: [
      { label: "Βασική χρέωση", amount: base },
      { label: `Χιλιόμετρα (${Math.round(distanceKm)} km)`, amount: Math.round(distance) },
      { label: `Χρόνος (${input.durationHours} ώρες)`, amount: Math.round(hours) },
      { label: "Προσαρμογή οχήματος & ατόμων", amount: Math.max(0, subtotal - Math.round(base + distance + hours)) },
      { label: "Προμήθεια πλατφόρμας", amount: platformFee },
    ],
  };
}
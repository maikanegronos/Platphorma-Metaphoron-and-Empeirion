import { Router, type IRouter } from "express";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import {
  ClaimDriverJobBody,
  ClaimDriverJobParams,
  ClaimDriverJobResponse,
  CreateBookingBody,
  CreateBookingResponse,
  CreateDriverDocumentBody,
  CreateDriverDocumentResponse,
  CreateQuoteBody,
  CreateQuoteResponse,
  UpdateDriverJobStatusBody,
  GetDashboardSummaryResponse,
  GetExperienceParams,
  GetExperienceResponse,
  ListAdminDriversResponse,
  ListAdminDriverDocumentsResponse,
  ListBookingsQueryParams,
  ListBookingsResponse,
  ListDriverJobsResponse,
  ListExperiencesResponse,
  ReviewDriverBody,
  ReviewDriverParams,
  ReviewDriverResponse,
  ReviewDriverDocumentBody,
  ReviewDriverDocumentParams,
  ReviewDriverDocumentResponse,
} from "@workspace/api-zod";
import {
  bookingsTable,
  db,
  driverJobsTable,
  driverDocumentsTable,
  driversTable,
  experiencesTable,
} from "@workspace/db";
import { calculateQuote, formatDate } from "../lib/travel-data";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

function bookingResponse(booking: typeof bookingsTable.$inferSelect) {
  return {
    id: booking.id,
    title: booking.title,
    date: booking.scheduledDate,
    time: booking.scheduledTime,
    customerPhone: booking.customerPhone,
    pickup: booking.pickup,
    passengers: booking.passengers,
    total: booking.total,
    paid: booking.paid,
    status: booking.status,
    driverName: booking.driverName,
    vehicle: booking.vehicle,
  };
}

function driverJobResponse(job: typeof driverJobsTable.$inferSelect) {
  return {
    id: job.id,
    bookingId: job.bookingId,
    title: job.title,
    date: job.scheduledDate,
    time: job.time,
    pickup: job.pickup,
    destination: job.destination,
    passengers: job.passengers,
    vehicleType: job.vehicleType,
    payout: job.payout,
    distanceKm: job.distanceKm,
    status: job.status,
    isCustom: Boolean(job.isCustom),
    customerPhone: job.customerPhone,
  };
}

function driverDocumentResponse(document: typeof driverDocumentsTable.$inferSelect) {
  return {
    id: document.id,
    driverId: document.driverId,
    objectPath: document.objectPath,
    fileName: document.fileName,
    contentType: document.contentType,
    size: document.size,
    status: document.status,
    createdAt: document.createdAt,
  };
}

async function ensureDriverProfile(userId: string): Promise<void> {
  const [existing] = await db.select({ id: driversTable.id }).from(driversTable).where(eq(driversTable.id, userId));
  if (existing) return;

  let name = "Νέος οδηγός";
  try {
    const user = await clerkClient.users.getUser(userId);
    name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || name;
  } catch {
    // Clerk lookup is best-effort; fall back to the default name below.
  }

  await db
    .insert(driversTable)
    .values({
      id: userId,
      name,
      city: "—",
      vehicle: "—",
      vehicleType: "—",
      rating: 0,
      trips: 0,
      status: "pending",
      documents: 0,
    })
    .onConflictDoNothing();
}

function driverResponse(driver: typeof driversTable.$inferSelect) {
  return {
    id: driver.id,
    name: driver.name,
    city: driver.city,
    vehicle: driver.vehicle,
    vehicleType: driver.vehicleType,
    rating: driver.rating,
    trips: driver.trips,
    status: driver.status,
    documents: driver.documents,
  };
}

router.get("/experiences", async (_req, res): Promise<void> => {
  const experiences = await db
    .select()
    .from(experiencesTable)
    .orderBy(asc(experiencesTable.id));
  res.json(ListExperiencesResponse.parse(experiences));
});

router.get("/experiences/:id", async (req, res): Promise<void> => {
  const params = GetExperienceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [experience] = await db
    .select()
    .from(experiencesTable)
    .where(eq(experiencesTable.id, params.data.id));
  if (!experience) {
    res.status(404).json({ error: "Experience not found" });
    return;
  }

  res.json(GetExperienceResponse.parse(experience));
});

router.post("/quotes", async (req, res): Promise<void> => {
  const parsed = CreateQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const quote = calculateQuote(parsed.data);
  res.json(CreateQuoteResponse.parse(quote));
});

router.get("/bookings", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListBookingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.customerId, req.userId!))
    .orderBy(asc(bookingsTable.scheduledDate));
  res.json(ListBookingsResponse.parse(bookings.map(bookingResponse)));
});

router.post("/bookings", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { data } = parsed;
  const bookingId = `booking-${Date.now()}`;
  const scheduledDate = formatDate(data.date);
  const [booking] = await db.transaction(async (tx) => {
    const [createdBooking] = await tx
      .insert(bookingsTable)
      .values({
        id: bookingId,
        customerId: req.userId!,
        experienceId: data.experienceId ?? null,
        title: data.title,
        scheduledDate,
        scheduledTime: data.time,
        customerPhone: data.customerPhone,
        pickup: data.pickup,
        passengers: Math.round(data.passengers),
        total: data.total,
        paid: 0,
        status: "pending",
        driverName: null,
        vehicle: null,
      })
      .returning();

    await tx.insert(driverJobsTable).values({
      id: `job-${bookingId}`,
      bookingId,
      title: data.title,
      scheduledDate,
      time: data.time,
      pickup: data.pickup,
      destination: data.destination ?? data.title,
      passengers: Math.round(data.passengers),
      vehicleType: data.vehicleType ?? "van",
      payout: Math.round(data.total * 0.82 * 100) / 100,
      distanceKm: 0,
      status: "open",
      isCustom: data.experienceId ? 0 : 1,
      customerPhone: data.customerPhone,
    });

    return [createdBooking];
  });

  res.status(201).json(CreateBookingResponse.parse(bookingResponse(booking)));
});

router.patch("/bookings/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const bookingId = req.params.id as string;
  const [booking] = await db
    .update(bookingsTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(bookingsTable.id, bookingId),
        eq(bookingsTable.customerId, req.userId!),
        or(eq(bookingsTable.status, "pending"), eq(bookingsTable.status, "confirmed")),
      ),
    )
    .returning();

  if (!booking) {
    const [existing] = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.customerId, req.userId!)));
    res.status(existing ? 409 : 404).json({ error: existing ? "Η κράτηση δεν μπορεί πλέον να ακυρωθεί." : "Η κράτηση δεν βρέθηκε." });
    return;
  }

  await db
    .update(driverJobsTable)
    .set({ status: "cancelled" })
    .where(eq(driverJobsTable.bookingId, booking.id));

  res.json(CreateBookingResponse.parse(bookingResponse(booking)));
});

router.get("/driver/jobs", requireRole("driver"), async (req, res): Promise<void> => {
  const jobs = await db
    .select()
    .from(driverJobsTable)
    .where(or(eq(driverJobsTable.status, "open"), eq(driverJobsTable.claimedDriverId, req.userId!)))
    .orderBy(asc(driverJobsTable.scheduledDate));
  res.json(ListDriverJobsResponse.parse(jobs.map(driverJobResponse)));
});

router.post("/driver/jobs/:id/claim", requireRole("driver"), async (req, res): Promise<void> => {
  const params = ClaimDriverJobParams.safeParse(req.params);
  const body = ClaimDriverJobBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [job] = await db
    .update(driverJobsTable)
    .set({
      status: "claimed",
       claimedDriverId: req.userId!,
      claimedVehicle: body.data.vehicle,
    })
    .where(and(eq(driverJobsTable.id, params.data.id), eq(driverJobsTable.status, "open")))
    .returning();

  if (!job) {
    res.status(409).json({ error: "This job is no longer available" });
    return;
  }

  if (job.bookingId) {
    await db
      .update(bookingsTable)
      .set({ driverName: "Ο οδηγός σου", vehicle: body.data.vehicle })
      .where(eq(bookingsTable.id, job.bookingId));
  }

  res.json(ClaimDriverJobResponse.parse(driverJobResponse(job)));
});

router.patch("/driver/jobs/:id/status", requireRole("driver"), async (req, res): Promise<void> => {
  const jobId = req.params.id as string;
  const body = UpdateDriverJobStatusBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [current] = await db
    .select()
    .from(driverJobsTable)
    .where(and(eq(driverJobsTable.id, jobId), eq(driverJobsTable.claimedDriverId, req.userId!)));
  if (!current) {
    res.status(404).json({ error: "Η διαδρομή δεν βρέθηκε." });
    return;
  }
  const validTransition =
    (current.status === "claimed" && body.data.status === "in-progress") ||
    (current.status === "in-progress" && body.data.status === "completed");
  if (!validTransition) {
    res.status(409).json({ error: "Μη έγκυρη αλλαγή κατάστασης διαδρομής." });
    return;
  }

  const [job] = await db
    .update(driverJobsTable)
    .set({ status: body.data.status })
    .where(eq(driverJobsTable.id, current.id))
    .returning();

  if (job.bookingId) {
    await db
      .update(bookingsTable)
      .set({ status: body.data.status === "completed" ? "completed" : "in-progress" })
      .where(eq(bookingsTable.id, job.bookingId));
  }

  res.json(ClaimDriverJobResponse.parse(driverJobResponse(job)));
});

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.customerId, req.userId!))
    .orderBy(asc(bookingsTable.scheduledDate));
  const futureBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const totalSpent = bookings.reduce((sum, booking) => sum + booking.paid, 0);
  const summary = {
    upcomingCount: futureBookings.filter((booking) => booking.status === "confirmed" || booking.status === "pending").length,
    totalTrips: bookings.length,
    totalSpent,
    savedPlaces: 4,
    nextBooking: futureBookings[0] ? bookingResponse(futureBookings[0]) : null,
  };
  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/admin/drivers", requireRole("operator"), async (_req, res): Promise<void> => {
  const drivers = await db
    .select()
    .from(driversTable)
    .orderBy(asc(driversTable.status), asc(driversTable.name));
  res.json(ListAdminDriversResponse.parse(drivers.map(driverResponse)));
});

router.get("/admin/bookings", requireRole("operator"), async (_req, res): Promise<void> => {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .orderBy(asc(bookingsTable.scheduledDate));
  res.json(ListBookingsResponse.parse(bookings.map(bookingResponse)));
});

router.patch("/admin/drivers/:id/review", requireRole("operator"), async (req, res): Promise<void> => {
  const params = ReviewDriverParams.safeParse(req.params);
  const body = ReviewDriverBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [driver] = await db
    .update(driversTable)
    .set({ status: body.data.status })
    .where(eq(driversTable.id, params.data.id))
    .returning();
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }

  res.json(ReviewDriverResponse.parse(driverResponse(driver)));
});

router.post("/driver/documents", requireRole("driver"), async (req, res): Promise<void> => {
  const body = CreateDriverDocumentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  await ensureDriverProfile(req.userId!);

  const [document] = await db.transaction(async (tx) => {
    const [createdDocument] = await tx
      .insert(driverDocumentsTable)
      .values({
        id: randomUUID(),
        driverId: req.userId!,
        objectPath: body.data.objectPath,
        fileName: body.data.fileName,
        contentType: body.data.contentType,
        size: Math.round(body.data.size),
        status: "pending",
      })
      .returning();

    await tx
      .update(driversTable)
      .set({ documents: sql`${driversTable.documents} + 1` })
      .where(eq(driversTable.id, req.userId!));

    return [createdDocument];
  });

  res.status(201).json(CreateDriverDocumentResponse.parse(driverDocumentResponse(document)));
});

router.get("/admin/driver-documents", requireRole("operator"), async (_req, res): Promise<void> => {
  const documents = await db
    .select()
    .from(driverDocumentsTable)
    .orderBy(desc(driverDocumentsTable.createdAt));
  res.json(ListAdminDriverDocumentsResponse.parse(documents.map(driverDocumentResponse)));
});

router.patch("/admin/driver-documents/:id/review", requireRole("operator"), async (req, res): Promise<void> => {
  const params = ReviewDriverDocumentParams.safeParse(req.params);
  const body = ReviewDriverDocumentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [document] = await db
    .update(driverDocumentsTable)
    .set({ status: body.data.status })
    .where(eq(driverDocumentsTable.id, params.data.id))
    .returning();
  if (!document) {
    res.status(404).json({ error: "Το έγγραφο δεν βρέθηκε." });
    return;
  }

  res.json(ReviewDriverDocumentResponse.parse(driverDocumentResponse(document)));
});

export default router;
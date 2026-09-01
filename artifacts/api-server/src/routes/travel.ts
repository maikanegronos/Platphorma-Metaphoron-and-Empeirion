import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  ClaimDriverJobBody,
  ClaimDriverJobParams,
  ClaimDriverJobResponse,
  CreateBookingBody,
  CreateBookingResponse,
  CreateQuoteBody,
  CreateQuoteResponse,
  GetDashboardSummaryResponse,
  GetExperienceParams,
  GetExperienceResponse,
  ListAdminDriversResponse,
  ListBookingsQueryParams,
  ListBookingsResponse,
  ListDriverJobsResponse,
  ListExperiencesResponse,
  ReviewDriverBody,
  ReviewDriverParams,
  ReviewDriverResponse,
} from "@workspace/api-zod";
import {
  bookingsTable,
  db,
  driverJobsTable,
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
  };
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
  const paid = data.paymentPlan === "full" ? data.total : Math.round(data.total * 0.3 * 100) / 100;
  const [booking] = await db
    .insert(bookingsTable)
    .values({
      id: `booking-${Date.now()}`,
       customerId: req.userId!,
      experienceId: data.experienceId ?? null,
      title: data.title,
      scheduledDate: formatDate(data.date),
      pickup: data.pickup,
      passengers: Math.round(data.passengers),
      total: data.total,
      paid,
      status: "confirmed",
      driverName: null,
      vehicle: null,
    })
    .returning();

  res.status(201).json(CreateBookingResponse.parse(bookingResponse(booking)));
});

router.get("/driver/jobs", requireRole("driver"), async (_req, res): Promise<void> => {
  const jobs = await db
    .select()
    .from(driverJobsTable)
    .where(eq(driverJobsTable.status, "open"))
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

export default router;
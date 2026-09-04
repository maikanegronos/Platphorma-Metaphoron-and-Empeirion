import { Readable } from "node:stream";
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { db, driverDocumentsTable } from "@workspace/db";
import { getAccountRole, requireAuth } from "../lib/auth";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxFileSize = 10 * 1024 * 1024;

router.post("/storage/uploads/request-url", requireAuth, async (req, res): Promise<void> => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Λείπουν ή δεν είναι έγκυρα τα στοιχεία αρχείου." });
    return;
  }
  const { name, size, contentType } = parsed.data;
  if (!allowedTypes.has(contentType) || size > maxFileSize) {
    res.status(400).json({ error: "Επιτρέπονται PDF, JPG ή PNG έως 10MB." });
    return;
  }

  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    res.json(RequestUploadUrlResponse.parse({
      uploadURL,
      objectPath,
      metadata: { name, size, contentType },
    }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create object storage upload URL");
    res.status(500).json({ error: "Δεν δημιουργήθηκε URL αποστολής." });
  }
});

router.get("/storage/objects/*path", requireAuth, async (req, res): Promise<void> => {
  const rawPath = req.params.path;
  const objectPath = `/objects/${Array.isArray(rawPath) ? rawPath.join("/") : rawPath}`;
  const role = await getAccountRole(req.userId!);
  const [document] = await db.select().from(driverDocumentsTable).where(eq(driverDocumentsTable.objectPath, objectPath));
  if (!document) {
    res.status(404).json({ error: "Το αρχείο δεν βρέθηκε." });
    return;
  }
  if (role !== "operator" && document.driverId !== req.userId) {
    res.status(403).json({ error: "Δεν έχεις πρόσβαση σε αυτό το αρχείο." });
    return;
  }

  try {
    const response = await objectStorage.downloadObject(await objectStorage.getObjectEntityFile(objectPath));
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Το αρχείο δεν βρέθηκε." });
      return;
    }
    req.log.error({ err: error }, "Failed to serve private object");
    res.status(500).json({ error: "Δεν ήταν δυνατή η ανάκτηση του αρχείου." });
  }
});

export default router;
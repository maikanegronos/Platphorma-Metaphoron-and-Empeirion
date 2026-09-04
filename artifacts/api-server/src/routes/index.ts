import { Router, type IRouter } from "express";
import healthRouter from "./health";
import travelRouter from "./travel";
import authRouter from "./auth";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(travelRouter);

export default router;

import { Router } from "express";
const router = Router();
router.get("/", (req, res) => {
  res.json({ ok: true, service: 'curalogic-backend' });
})
export default router;

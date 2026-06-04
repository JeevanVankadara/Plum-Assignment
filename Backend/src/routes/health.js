import { Router } from "express";
const router = Router();
router.get("/", (req, res) => {
  console.log('Server is running fine');
})
export default router;

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './src/config/db.js';
import { loadPolicy } from './src/config/policy.js';
import claimsRoutes from './src/routes/claims.js';
import healthRoutes from './src/routes/health.js';
import { errorHandler } from './src/middleware/errorHandler.js';

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.use('/api/health', healthRoutes);
app.use('/api/claims', claimsRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;

(async () => {
  await connectDB();
  loadPolicy();
  app.listen(PORT, () => console.log(`PLUM-claim backend running on :${PORT}`));
})();

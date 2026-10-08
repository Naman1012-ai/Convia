import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from './middleware/authMiddleware.js';
import { blueprintRouter } from './routes/blueprintRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { userRouter } from './routes/userRoutes.js';
import { searchRouter } from './routes/searchRoutes.js';
import { workspaceDashboardRouter } from './routes/workspaceDashboardRoutes.js';
import { workspaceInvitationRouter } from './routes/workspaceInvitationRoutes.js';
import { uploadthingExpressHandler } from './routes/uploadthingRouter.js';
import { fcmRouter } from './routes/fcmRoutes.js';
import { publicIdeaRouter } from './routes/publicIdeaRoutes.js';
import { chatRouter } from './routes/chatRoutes.js';
import { taskRouter } from './routes/taskRoutes.js';
import { globalStatsService } from './services/globalStatsService.js';

// Resolve current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Configure proxy trust safely: only trust first proxy if behind Vercel/Render or explicitly configured
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
} else if (process.env.VERCEL || process.env.RENDER) {
  app.set('trust proxy', 1);
}

import { sanitizationMiddleware } from './middleware/sanitizationMiddleware.js';
import { publicRateLimiter, healthRateLimiter } from './middleware/rateLimitMiddleware.js';

// Middleware
app.use(cors({
  origin: '*', // Allows localhost:3000 and deployment frontends
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Handle malformed JSON body errors before they reach routes
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MALFORMED_JSON',
        message: 'The request body is not valid JSON.',
      },
    });
  }
  next(err);
});

app.use(sanitizationMiddleware);
app.use(authMiddleware);

// Health Check Route (Tier 0 Lightweight Liveness Probe)
app.get('/api/health', healthRateLimiter, (req, res) => {
  res.json({
    status: 'ok',
    service: 'Convia Express Backend API',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Public Global Stats Endpoint (Reads from aggregated globalStats node)
app.get('/api/stats/global', publicRateLimiter, async (req, res) => {
  try {
    const stats = await globalStatsService.getGlobalStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve global stats.', code: 'STATS_ERROR' },
    });
  }
});

// API Routes
app.use('/api/blueprint', blueprintRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);
app.use('/api/search', searchRouter);
app.use('/api/workspace', workspaceDashboardRouter);
app.use('/api/invitations', workspaceInvitationRouter);
app.use('/api/uploadthing', uploadthingExpressHandler);
app.use('/api/notifications/fcm', fcmRouter);
app.use('/api/public-ideas', publicIdeaRouter);
app.use('/api/workspaces/:workspaceId/chat', chatRouter);
app.use('/api/workspace/:workspaceId/chat', chatRouter);
app.use('/api/workspaces/:workspaceId/tasks', taskRouter);
app.use('/api/workspace/:workspaceId/tasks', taskRouter);

// Safe Production Error Handler (Masks stack traces and internal secrets)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const cleanMessage = String(err.message || 'Internal server error.')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[MASKED_KEY]')
    .replace(/[a-zA-Z0-9_-]{32,}/g, (match) => match.length > 40 ? '[MASKED_SECRET]' : match);

  console.error(`🚨 [GlobalErrorHandler] ${req.method} ${req.path} -> HTTP ${statusCode}:`, err.message);

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: isProd && statusCode === 500 ? 'An unexpected server error occurred.' : cleanMessage,
    },
  });
});

// Start Express Server (Only in traditional standalone node server environment)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 [Convia Backend] Express server running at http://localhost:${PORT}`);
    console.log(`⚡ [Convia Backend] Gemini AI Model: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}`);

    // Asynchronously refresh global aggregate statistics in background
    globalStatsService.calculateAndSyncGlobalStats().catch((err) => {
      console.warn('⚠️ [globalStats] Startup aggregate sync warning:', err.message);
    });
  });
}

export default app;

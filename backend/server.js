require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { sendDeadlineEmailAlerts } = require('./utils/deadlineEmailAlerts');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const hasSupabaseConfig = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const hasEmailConfig = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const supabase = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null;
const serverSupabase = hasSupabaseConfig
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    )
  : null;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

const tasksRouter = require('./routes/tasks');
const analyticsRouter = require('./routes/analytics');
const rewardsRouter = require('./routes/rewards');
const scheduleRouter = require('./routes/schedule');

app.use('/api/tasks', tasksRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/schedule', scheduleRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    supabaseConfigured: hasSupabaseConfig,
    serviceRoleConfigured: hasServiceRoleKey,
    emailConfigured: hasEmailConfig
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.get('/:page(index|signup|dashboard|tasks|analytics|rewards|accounts|reset-password).html', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, `${req.params.page}.html`));
});

if (serverSupabase) {
  cron.schedule('0 * * * *', async () => {
    try {
      const { error } = await serverSupabase
        .from('tasks')
        .update({ status: 'overdue' })
        .lt('deadline', new Date().toISOString())
        .eq('status', 'pending');

      if (error) {
        console.error('Deadline check failed:', error.message);
      }
    } catch (error) {
      console.error('Unexpected deadline check error:', error.message);
    }
  });

  cron.schedule('0 0 * * *', async () => {
    try {
      const { data: users, error: usersError } = await serverSupabase
        .from('user_profiles')
        .select('id');

      if (usersError) {
        throw usersError;
      }

      for (const user of users || []) {
        const { data: tasks, error: tasksError } = await serverSupabase
          .from('tasks')
          .select('status')
          .eq('user_id', user.id);

        if (tasksError) {
          console.error(`Skipping productivity update for ${user.id}:`, tasksError.message);
          continue;
        }

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((task) => task.status === 'completed').length;
        const productivityScore = totalTasks > 0 ? Number(((completedTasks / totalTasks) * 100).toFixed(2)) : 0;

        const { error: updateError } = await serverSupabase
          .from('user_profiles')
          .update({ productivity_score: productivityScore })
          .eq('id', user.id);

        if (updateError) {
          console.error(`Failed to update productivity score for ${user.id}:`, updateError.message);
        }
      }
    } catch (error) {
      console.error('Unexpected productivity update error:', error.message);
    }
  });

  cron.schedule('*/15 * * * *', async () => {
    try {
      if (!hasServiceRoleKey) {
        console.warn('Skipping deadline email alerts. SUPABASE_SERVICE_ROLE_KEY is required for server-side scans.');
        return;
      }

      const results = await sendDeadlineEmailAlerts(serverSupabase);
      if (results.sent || results.failed || results.skipped) {
        console.log('Deadline email alert results:', results);
      }
    } catch (error) {
      console.error('Unexpected deadline email alert error:', error.message);
    }
  });

  if (!hasEmailConfig) {
    console.warn('Deadline email alerts are enabled but email is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }
} else {
  console.warn('Supabase env vars are missing. API routes that use Supabase will fail until they are configured.');
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app, supabase, serverSupabase };

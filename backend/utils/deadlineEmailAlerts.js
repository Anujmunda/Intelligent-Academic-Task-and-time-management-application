const { sendDeadlineReminderEmail } = require('./notifications');

const NOTIFICATION_TYPE = 'deadline_24h_email';

function getUserProfile(task) {
  return Array.isArray(task.user_profiles)
    ? task.user_profiles[0]
    : task.user_profiles;
}

async function fetchTasksNeedingDeadlineEmail(supabase) {
  const now = new Date();
  const finalDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, user_id, title, deadline, user_profiles(email, full_name)')
    .eq('status', 'pending')
    .gt('deadline', now.toISOString())
    .lte('deadline', finalDay.toISOString())
    .order('deadline', { ascending: true });

  if (error) throw error;
  if (!tasks || tasks.length === 0) return [];

  const taskIds = tasks.map((task) => task.id);
  const { data: existingNotifications, error: notificationsError } = await supabase
    .from('deadline_email_notifications')
    .select('task_id')
    .eq('notification_type', NOTIFICATION_TYPE)
    .eq('status', 'sent')
    .in('task_id', taskIds);

  if (notificationsError) throw notificationsError;

  const notifiedTaskIds = new Set((existingNotifications || []).map((notification) => notification.task_id));
  return tasks.filter((task) => !notifiedTaskIds.has(task.id));
}

async function recordDeadlineEmailNotification(supabase, { task, emailTo, status, errorMessage, providerId }) {
  const { error } = await supabase
    .from('deadline_email_notifications')
    .upsert([{
      user_id: task.user_id,
      task_id: task.id,
      notification_type: NOTIFICATION_TYPE,
      email_to: emailTo,
      status,
      error_message: errorMessage || null,
      provider_id: providerId || null
    }], { onConflict: 'task_id,notification_type' });

  if (error) {
    throw error;
  }
}

async function sendDeadlineEmailAlerts(supabase) {
  const tasks = await fetchTasksNeedingDeadlineEmail(supabase);
  const results = {
    checked: tasks.length,
    sent: 0,
    skipped: 0,
    failed: 0
  };

  for (const task of tasks) {
    const profile = getUserProfile(task);
    const emailTo = profile?.email;

    if (!emailTo) {
      results.skipped += 1;
      await recordDeadlineEmailNotification(supabase, {
        task,
        emailTo: null,
        status: 'skipped',
        errorMessage: 'User profile does not have an email address.'
      });
      continue;
    }

    try {
      const emailResult = await sendDeadlineReminderEmail({
        to: emailTo,
        taskTitle: task.title
      });

      if (emailResult.skipped) {
        results.skipped += 1;
        console.warn(`Deadline email skipped for task ${task.id}: ${emailResult.reason}`);
        continue;
      }

      await recordDeadlineEmailNotification(supabase, {
        task,
        emailTo,
        status: 'sent',
        providerId: emailResult.providerId
      });
      results.sent += 1;
    } catch (error) {
      results.failed += 1;
      console.error(`Deadline email failed for task ${task.id}:`, error.message);

      await recordDeadlineEmailNotification(supabase, {
        task,
        emailTo,
        status: 'failed',
        errorMessage: error.message
      });
    }
  }

  return results;
}

module.exports = {
  sendDeadlineEmailAlerts
};

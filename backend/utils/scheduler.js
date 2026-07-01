const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Generate smart study schedule based on tasks
 * Algorithm:
 * 1. Sort tasks by priority and deadline
 * 2. Allocate time slots starting from today
 * 3. Balance workload across days
 */
async function generateStudySchedule(userId) {
  try {
    // Get all pending tasks
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('deadline', { ascending: true });

    if (error) throw error;

    // Clear existing schedule
    await supabase
      .from('study_schedule')
      .delete()
      .eq('user_id', userId);

    // Priority weights
    const priorityWeight = { High: 3, Medium: 2, Low: 1 };

    // Sort tasks by priority and deadline
    const sortedTasks = tasks.sort((a, b) => {
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.deadline) - new Date(b.deadline);
    });

    const schedule = [];
    const startDate = new Date();
    let currentDay = 0;
    let dailyHours = 0;
    const maxDailyHours = 6; // Maximum 6 hours of study per day

    for (const task of sortedTasks) {
      const taskHours = priorityWeight[task.priority]; // High=3h, Medium=2h, Low=1h
      
      // If adding this task exceeds daily limit, move to next day
      if (dailyHours + taskHours > maxDailyHours) {
        currentDay++;
        dailyHours = 0;
      }

      const scheduleDate = new Date(startDate);
      scheduleDate.setDate(scheduleDate.getDate() + currentDay);

      // Schedule at 9 AM + current daily hours
      const scheduleTime = `${9 + dailyHours}:00:00`;

      schedule.push({
        user_id: userId,
        task_id: task.id,
        scheduled_date: scheduleDate.toISOString().split('T')[0],
        scheduled_time: scheduleTime,
        duration_minutes: taskHours * 60
      });

      dailyHours += taskHours;
    }

    // Insert schedule into database
    if (schedule.length > 0) {
      const { data, error: insertError } = await supabase
        .from('study_schedule')
        .insert(schedule);

      if (insertError) throw insertError;
    }

    return { success: true, schedule };
  } catch (error) {
    console.error('Error generating schedule:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { generateStudySchedule };

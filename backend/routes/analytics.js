const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Get weekly progress data
router.get('/:userId/weekly', async (req, res) => {
  try {
    const { userId } = req.params;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('tasks')
      .select('completed_at, status')
      .eq('user_id', userId)
      .gte('completed_at', sevenDaysAgo.toISOString());

    if (error) throw error;

    // Group by day
    const weeklyData = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      weeklyData[dateStr] = 0;
    }

    data.forEach(task => {
      if (task.completed_at) {
        const dateStr = task.completed_at.split('T')[0];
        if (weeklyData[dateStr] !== undefined) {
          weeklyData[dateStr]++;
        }
      }
    });

    res.json({ success: true, data: weeklyData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get task completion trends
router.get('/:userId/trends', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('status, priority')
      .eq('user_id', userId);

    if (error) throw error;

    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      overdue: tasks.filter(t => t.status === 'overdue').length,
      byPriority: {
        high: tasks.filter(t => t.priority === 'High').length,
        medium: tasks.filter(t => t.priority === 'Medium').length,
        low: tasks.filter(t => t.priority === 'Low').length
      }
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get productivity insights
router.get('/:userId/insights', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('productivity_score, study_streak, reward_points')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('status, completed_at')
      .eq('user_id', userId);

    if (tasksError) throw tasksError;

    const completedToday = tasks.filter(t => {
      if (!t.completed_at) return false;
      const completedDate = new Date(t.completed_at).toDateString();
      const today = new Date().toDateString();
      return completedDate === today;
    }).length;

    res.json({
      success: true,
      data: {
        productivity_score: profile.productivity_score,
        study_streak: profile.study_streak,
        reward_points: profile.reward_points,
        completed_today: completedToday,
        total_tasks: tasks.length,
        completion_rate: tasks.length > 0 ? 
          ((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

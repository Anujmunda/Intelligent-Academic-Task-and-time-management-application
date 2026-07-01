const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Get all tasks for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('deadline', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new task
router.post('/', async (req, res) => {
  try {
    const { user_id, title, description, deadline, priority } = req.body;
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ user_id, title, description, deadline, priority }])
      .select();

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a task
router.put('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select();

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a task
router.delete('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark task as completed
router.post('/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_id } = req.body;
    
    const { data, error } = await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
      .select();

    if (error) throw error;

    // Award points
    const points = data[0].priority === 'High' ? 15 : data[0].priority === 'Medium' ? 10 : 5;
    await supabase.rpc('increment_reward_points', { user_id, points });

    res.json({ success: true, data: data[0], points_earned: points });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get risk alerts
router.get('/:userId/alerts', async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();
    const fortyEightHoursLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lte('deadline', fortyEightHoursLater.toISOString())
      .order('deadline', { ascending: true });

    if (error) throw error;

    const alerts = data.map(task => {
      const deadline = new Date(task.deadline);
      const isOverdue = deadline < now;
      return {
        ...task,
        alert_type: isOverdue ? 'critical' : 'warning',
        message: isOverdue ? 'Overdue!' : 'Due soon'
      };
    });

    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

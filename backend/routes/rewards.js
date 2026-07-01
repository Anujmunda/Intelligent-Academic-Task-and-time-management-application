const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Get user rewards
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Award a badge
router.post('/', async (req, res) => {
  try {
    const { user_id, badge_name, badge_type, description } = req.body;
    
    const { data, error } = await supabase
      .from('rewards')
      .insert([{ user_id, badge_name, badge_type, description }])
      .select();

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update study streak
router.post('/:userId/streak', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('study_streak, last_activity_date')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    const today = new Date().toISOString().split('T')[0];
    const lastActivity = profile.last_activity_date;
    
    let newStreak = profile.study_streak;
    
    if (!lastActivity) {
      newStreak = 1;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastActivity === yesterdayStr) {
        newStreak += 1;
      } else if (lastActivity !== today) {
        newStreak = 1;
      }
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ 
        study_streak: newStreak, 
        last_activity_date: today 
      })
      .eq('id', userId)
      .select();

    if (error) throw error;

    // Award streak badges
    if (newStreak === 7) {
      await supabase.from('rewards').insert([{
        user_id: userId,
        badge_name: '7-Day Streak',
        badge_type: 'streak',
        description: 'Completed tasks for 7 consecutive days'
      }]);
    } else if (newStreak === 30) {
      await supabase.from('rewards').insert([{
        user_id: userId,
        badge_name: '30-Day Streak',
        badge_type: 'streak',
        description: 'Completed tasks for 30 consecutive days'
      }]);
    }

    res.json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

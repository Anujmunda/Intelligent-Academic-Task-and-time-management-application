-- Sample Data for Testing
-- Note: Replace 'YOUR_USER_ID' with actual user ID from Supabase Auth

-- Sample user profile (insert after user signs up)
-- INSERT INTO public.user_profiles (id, full_name, email, productivity_score, study_streak, reward_points)
-- VALUES ('YOUR_USER_ID', 'John Doe', 'john@example.com', 75.5, 5, 150);

-- Sample tasks
-- INSERT INTO public.tasks (user_id, title, description, deadline, priority, status) VALUES
-- ('YOUR_USER_ID', 'Complete Math Assignment', 'Finish calculus problems 1-20', NOW() + INTERVAL '2 days', 'High', 'pending'),
-- ('YOUR_USER_ID', 'Read Chapter 5', 'Read and take notes on Biology Chapter 5', NOW() + INTERVAL '3 days', 'Medium', 'pending'),
-- ('YOUR_USER_ID', 'Prepare Presentation', 'Create slides for history presentation', NOW() + INTERVAL '5 days', 'High', 'pending'),
-- ('YOUR_USER_ID', 'Lab Report', 'Write chemistry lab report', NOW() + INTERVAL '1 day', 'High', 'pending'),
-- ('YOUR_USER_ID', 'Study for Quiz', 'Review notes for physics quiz', NOW() + INTERVAL '4 days', 'Medium', 'pending');

-- Sample goals
-- INSERT INTO public.goals (user_id, title, description, target_date, progress, status) VALUES
-- ('YOUR_USER_ID', 'Maintain 90% Average', 'Keep grades above 90% in all subjects', NOW() + INTERVAL '90 days', 65, 'active'),
-- ('YOUR_USER_ID', 'Complete All Assignments On Time', 'Submit every assignment before deadline', NOW() + INTERVAL '30 days', 80, 'active');

-- Sample rewards
-- INSERT INTO public.rewards (user_id, badge_name, badge_type, description) VALUES
-- ('YOUR_USER_ID', 'First Task', 'completion', 'Completed your first task'),
-- ('YOUR_USER_ID', '5-Day Streak', 'streak', 'Maintained a 5-day study streak');

-- Function to increment reward points (used by backend)
CREATE OR REPLACE FUNCTION increment_reward_points(user_id UUID, points INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET reward_points = reward_points + points
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

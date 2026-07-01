const BADGE_CATALOG = [
  {
    id: 'streak_star',
    name: 'Streak Star',
    badge_type: 'streak',
    points: 25,
    description: 'Maintained a learning streak for 7, 15, or 30 days.',
    criteria: 'Reach at least a 7-day study streak.',
    isEarned: ({ profile, rewardNames }) =>
      (profile.study_streak || 0) >= 7 ||
      rewardNames.has('7-Day Streak') ||
      rewardNames.has('30-Day Streak'),
    progress: ({ profile }) => `${Math.min(profile.study_streak || 0, 30)}/7 days`
  },
  {
    id: 'daily_dynamo',
    name: 'Daily Dynamo',
    badge_type: 'streak',
    points: 30,
    description: 'Completed tasks every day for a week.',
    criteria: 'Complete at least one task on each of the last 7 days.',
    isEarned: ({ completedDateSet }) =>
      getRecentDateKeys(7).every((dateKey) => completedDateSet.has(dateKey)),
    progress: ({ completedDateSet }) => `${countRecentActiveDays(completedDateSet, 7)}/7 days`
  },
  {
    id: 'never_missed',
    name: 'Never Missed',
    badge_type: 'milestone',
    points: 40,
    description: 'No skipped study sessions in a month.',
    criteria: 'Complete every scheduled session from the last 30 days.',
    isEarned: ({ pastScheduledSessions }) =>
      pastScheduledSessions.length > 0 &&
      pastScheduledSessions.every((session) => session.tasks?.status === 'completed'),
    progress: ({ pastScheduledSessions }) => {
      if (pastScheduledSessions.length === 0) return '0 scheduled sessions';
      const completed = pastScheduledSessions.filter((session) => session.tasks?.status === 'completed').length;
      return `${completed}/${pastScheduledSessions.length} sessions`;
    }
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    badge_type: 'productivity',
    points: 20,
    description: 'Studied before 8 AM regularly.',
    criteria: 'Complete 5 tasks before 8 AM.',
    isEarned: ({ earlyCompletions }) => earlyCompletions >= 5,
    progress: ({ earlyCompletions }) => `${Math.min(earlyCompletions, 5)}/5 early tasks`
  },
  {
    id: 'night_owl_scholar',
    name: 'Night Owl Scholar',
    badge_type: 'productivity',
    points: 20,
    description: 'Completed lessons late at night consistently.',
    criteria: 'Complete 5 tasks at or after 10 PM.',
    isEarned: ({ lateCompletions }) => lateCompletions >= 5,
    progress: ({ lateCompletions }) => `${Math.min(lateCompletions, 5)}/5 late tasks`
  },
  {
    id: 'time_bender',
    name: 'Time Bender',
    badge_type: 'productivity',
    points: 25,
    description: 'Studied longer than planned.',
    criteria: 'Log a study session longer than its scheduled duration.',
    isEarned: ({ longerThanPlannedSessions }) => longerThanPlannedSessions >= 1,
    progress: ({ longerThanPlannedSessions }) => `${longerThanPlannedSessions} longer sessions`
  },
  {
    id: 'focus_monk',
    name: 'Focus Monk',
    badge_type: 'productivity',
    points: 25,
    description: 'Completed distraction-free study sessions.',
    criteria: 'Log 5 study sessions with notes marked focused or no distractions.',
    isEarned: ({ focusSessions }) => focusSessions >= 5,
    progress: ({ focusSessions }) => `${Math.min(focusSessions, 5)}/5 focus sessions`
  }
];

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRecentDateKeys(days) {
  const keys = [];
  const today = new Date();

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    keys.push(getLocalDateKey(date));
  }

  return keys;
}

function countRecentActiveDays(completedDateSet, days) {
  return getRecentDateKeys(days).filter((dateKey) => completedDateSet.has(dateKey)).length;
}

function getSessionDateTime(session) {
  return new Date(`${session.scheduled_date}T${session.scheduled_time || '00:00:00'}`);
}

function countLongerThanPlannedSessions(studyLogs, scheduledSessions) {
  const plannedMinutesByTask = new Map();

  scheduledSessions.forEach((session) => {
    if (!session.task_id || !session.duration_minutes) return;
    const currentPlanned = plannedMinutesByTask.get(session.task_id);
    const planned = Number(session.duration_minutes);

    if (!currentPlanned || planned < currentPlanned) {
      plannedMinutesByTask.set(session.task_id, planned);
    }
  });

  return studyLogs.filter((log) => {
    const planned = plannedMinutesByTask.get(log.task_id);
    return planned && Number(log.duration_minutes || 0) > planned;
  }).length;
}

function countFocusSessions(studyLogs) {
  return studyLogs.filter((log) => {
    const notes = String(log.notes || '').toLowerCase();
    return notes.includes('no distraction') ||
      notes.includes('no distractions') ||
      notes.includes('focused') ||
      notes.includes('focus session');
  }).length;
}

async function fetchBadgeContext(client, userId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    profileResult,
    taskResult,
    scheduleResult,
    logsResult,
    rewardsResult
  ] = await Promise.all([
    client
      .from('user_profiles')
      .select('study_streak, reward_points')
      .eq('id', userId)
      .single(),
    client
      .from('tasks')
      .select('id, status, completed_at')
      .eq('user_id', userId),
    client
      .from('study_schedule')
      .select('task_id, scheduled_date, scheduled_time, duration_minutes, tasks(status, completed_at)')
      .eq('user_id', userId)
      .gte('scheduled_date', getLocalDateKey(thirtyDaysAgo)),
    client
      .from('study_logs')
      .select('task_id, duration_minutes, study_date, notes')
      .eq('user_id', userId),
    client
      .from('rewards')
      .select('badge_name')
      .eq('user_id', userId)
  ]);

  if (profileResult.error) throw profileResult.error;
  if (taskResult.error) throw taskResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  if (logsResult.error) throw logsResult.error;
  if (rewardsResult.error) throw rewardsResult.error;

  const completedTasks = (taskResult.data || []).filter((task) => task.status === 'completed' && task.completed_at);
  const completedDateSet = new Set();
  let earlyCompletions = 0;
  let lateCompletions = 0;

  completedTasks.forEach((task) => {
    const completedAt = new Date(task.completed_at);
    completedDateSet.add(getLocalDateKey(completedAt));

    if (completedAt.getHours() < 8) earlyCompletions += 1;
    if (completedAt.getHours() >= 22) lateCompletions += 1;
  });

  const now = new Date();
  const pastScheduledSessions = (scheduleResult.data || []).filter((session) =>
    getSessionDateTime(session) < now
  );
  const studyLogs = logsResult.data || [];

  return {
    profile: profileResult.data || {},
    completedDateSet,
    earlyCompletions,
    lateCompletions,
    pastScheduledSessions,
    longerThanPlannedSessions: countLongerThanPlannedSessions(studyLogs, scheduleResult.data || []),
    focusSessions: countFocusSessions(studyLogs),
    rewardNames: new Set((rewardsResult.data || []).map((reward) => reward.badge_name))
  };
}

async function evaluateBadgeProgress(client, userId) {
  const context = await fetchBadgeContext(client, userId);

  return BADGE_CATALOG.map((badge) => {
    const earnedByCriteria = badge.isEarned(context);
    const alreadyAwarded = context.rewardNames.has(badge.name);

    return {
      ...badge,
      earned: earnedByCriteria || alreadyAwarded,
      alreadyAwarded,
      progress: badge.progress(context)
    };
  });
}

async function syncEarnedBadges({ client, userId }) {
  const badges = await evaluateBadgeProgress(client, userId);
  const badgesToAward = badges.filter((badge) => badge.earned && !badge.alreadyAwarded);

  if (badgesToAward.length === 0) {
    return { badges, awarded: [] };
  }

  const { error: insertError } = await client
    .from('rewards')
    .insert(badgesToAward.map((badge) => ({
      user_id: userId,
      badge_name: badge.name,
      badge_type: badge.badge_type,
      description: badge.description
    })));

  if (insertError) throw insertError;

  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('reward_points')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;

  const addedPoints = badgesToAward.reduce((total, badge) => total + badge.points, 0);
  const { error: pointsError } = await client
    .from('user_profiles')
    .update({ reward_points: (profile.reward_points || 0) + addedPoints })
    .eq('id', userId);

  if (pointsError) throw pointsError;

  return {
    badges: badges.map((badge) => (
      badgesToAward.some((awardedBadge) => awardedBadge.id === badge.id)
        ? { ...badge, alreadyAwarded: true }
        : badge
    )),
    awarded: badgesToAward
  };
}

window.BADGE_CATALOG = BADGE_CATALOG;
window.evaluateBadgeProgress = evaluateBadgeProgress;
window.syncEarnedBadges = syncEarnedBadges;

const dashboardSupabase = window.supabaseClient;
let currentUser = null;
let weeklyChart = null;

async function initDashboard() {
  currentUser = await checkAuth();
  if (!currentUser) return;

  await loadUserProfile();

  await Promise.all([
    loadTodayTasks(),
    loadRiskAlerts(),
    loadUpcomingDeadlines(),
    loadWeeklyProgress()
  ]);

  const dateElement = document.getElementById('currentDate');
  const today = new Date();
  dateElement.textContent = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

async function loadUserProfile() {
  try {
    const { data, error } = await dashboardSupabase
      .from('user_profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error) throw error;

    const fullName = data.full_name || 'Student';
    document.getElementById('userName').textContent = fullName.split(' ')[0];
    document.getElementById('userAvatar').textContent = fullName.charAt(0).toUpperCase();
    document.getElementById('productivityScore').textContent = `${data.productivity_score || 0}%`;
    document.getElementById('studyStreak').textContent = data.study_streak || 0;
    document.getElementById('rewardPoints').textContent = data.reward_points || 0;
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

async function loadTodayTasks() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await dashboardSupabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUser.id)
      .gte('deadline', today.toISOString())
      .lt('deadline', tomorrow.toISOString())
      .order('priority', { ascending: false });

    if (error) throw error;

    const container = document.getElementById('todayTasks');

    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">[]</div><p>No tasks for today</p></div>';
      document.getElementById('tasksCompleted').textContent = '0';
      return;
    }

    container.innerHTML = data.map((task) => `
      <li class="task-item">
        <input
          type="checkbox"
          class="task-checkbox"
          ${task.status === 'completed' ? 'checked' : ''}
          onchange="toggleTask('${task.id}', this.checked)"
        >
        <div class="task-content">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            <span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span>
            <span>${formatTime(task.deadline)}</span>
          </div>
        </div>
      </li>
    `).join('');

    document.getElementById('tasksCompleted').textContent = data.filter((task) => task.status === 'completed').length;
  } catch (error) {
    console.error('Error loading today tasks:', error);
  }
}

async function loadRiskAlerts() {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data, error } = await dashboardSupabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('status', 'pending')
      .lte('deadline', soon.toISOString())
      .order('deadline', { ascending: true });

    if (error) throw error;

    const container = document.getElementById('riskAlerts');

    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">OK</div><p>No urgent tasks</p></div>';
      return;
    }

    container.innerHTML = data.map((task) => {
      const isOverdue = new Date(task.deadline) < now;
      return `
        <div class="alert alert-${isOverdue ? 'critical' : 'warning'}">
          <div class="alert-icon">${isOverdue ? '!!' : '!'}</div>
          <div class="alert-content">
            <div class="alert-title">${task.title}</div>
            <div class="alert-message">${isOverdue ? 'Overdue' : 'Due soon'} - ${formatDate(task.deadline)}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading risk alerts:', error);
  }
}

async function loadUpcomingDeadlines() {
  try {
    const { data, error } = await dashboardSupabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('status', 'pending')
      .order('deadline', { ascending: true })
      .limit(5);

    if (error) throw error;

    const container = document.getElementById('upcomingDeadlines');

    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">+</div><p>No upcoming deadlines</p></div>';
      return;
    }

    container.innerHTML = data.map((task) => `
      <li class="task-item">
        <div class="task-content">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            <span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span>
            <span>${formatDate(task.deadline)}</span>
            <span>${getTimeUntilDeadline(task.deadline)}</span>
          </div>
        </div>
      </li>
    `).join('');
  } catch (error) {
    console.error('Error loading upcoming deadlines:', error);
  }
}

async function loadWeeklyProgress() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await dashboardSupabase
      .from('tasks')
      .select('completed_at')
      .eq('user_id', currentUser.id)
      .eq('status', 'completed')
      .gte('completed_at', sevenDaysAgo.toISOString());

    if (error) throw error;

    const weeklyData = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      weeklyData[date.toISOString().split('T')[0]] = 0;
    }

    data.forEach((task) => {
      if (!task.completed_at) return;
      const key = task.completed_at.split('T')[0];
      if (weeklyData[key] !== undefined) {
        weeklyData[key] += 1;
      }
    });

    const labels = Object.keys(weeklyData).map((date) => {
      const parsed = new Date(date);
      return parsed.toLocaleDateString('en-US', { weekday: 'short' });
    });

    const values = Object.values(weeklyData);
    const ctx = document.getElementById('weeklyChart').getContext('2d');

    if (weeklyChart) {
      weeklyChart.destroy();
    }

    weeklyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Tasks Completed',
          data: values,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading weekly progress:', error);
  }
}

async function updateStudyStreak() {
  const { data: profile, error: profileError } = await dashboardSupabase
    .from('user_profiles')
    .select('study_streak, last_activity_date')
    .eq('id', currentUser.id)
    .single();

  if (profileError) throw profileError;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak = profile.study_streak || 0;

  if (!profile.last_activity_date) {
    newStreak = 1;
  } else if (profile.last_activity_date === yesterdayStr) {
    newStreak += 1;
  } else if (profile.last_activity_date !== today) {
    newStreak = 1;
  }

  const { error: updateError } = await dashboardSupabase
    .from('user_profiles')
    .update({
      study_streak: newStreak,
      last_activity_date: today
    })
    .eq('id', currentUser.id);

  if (updateError) throw updateError;
}

async function checkForNewBadges() {
  if (!window.syncEarnedBadges) return [];

  const badgeSync = await window.syncEarnedBadges({
    client: dashboardSupabase,
    userId: currentUser.id
  });

  return badgeSync.awarded || [];
}

async function toggleTask(taskId, completed) {
  try {
    const { error } = await dashboardSupabase
      .from('tasks')
      .update({
        status: completed ? 'completed' : 'pending',
        completed_at: completed ? new Date().toISOString() : null
      })
      .eq('id', taskId);

    if (error) throw error;

    if (completed) {
      await updateStudyStreak();
      const awardedBadges = await checkForNewBadges();
      const badgeNames = awardedBadges.map((badge) => badge.name).join(', ');
      showNotification(
        badgeNames ? `New badge earned: ${badgeNames}` : 'Task completed!',
        'success'
      );
    }

    await Promise.all([loadUserProfile(), loadTodayTasks(), loadWeeklyProgress()]);
  } catch (error) {
    console.error('Error toggling task:', error);
    showNotification('Failed to update task', 'error');
  }
}

document.getElementById('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();

  try {
    const { error } = await dashboardSupabase.auth.signOut();
    if (error) throw error;
    window.goToAppPage('index.html');
  } catch (error) {
    console.error('Error logging out:', error);
  }
});

initDashboard();

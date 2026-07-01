const analyticsSupabase = window.supabaseClient;
let currentUser = null;
let weeklyChart = null;
let distributionChart = null;
let priorityChart = null;

async function init() {
  currentUser = await checkAuth();
  if (!currentUser) return;

  await Promise.all([
    loadInsights(),
    loadWeeklyProgress(),
    loadTaskDistribution(),
    loadPriorityBreakdown(),
    loadGoals()
  ]);

  document.getElementById('goalForm').addEventListener('submit', handleGoalSubmit);
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await analyticsSupabase.auth.signOut();
    window.goToAppPage('index.html');
  });
}

async function fetchTaskStats() {
  const { data: tasks, error } = await analyticsSupabase
    .from('tasks')
    .select('status, priority, completed_at')
    .eq('user_id', currentUser.id);

  if (error) throw error;

  const stats = {
    total: tasks.length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    overdue: tasks.filter((task) => task.status === 'overdue').length,
    byPriority: {
      high: tasks.filter((task) => task.priority === 'High').length,
      medium: tasks.filter((task) => task.priority === 'Medium').length,
      low: tasks.filter((task) => task.priority === 'Low').length
    }
  };

  return { tasks, stats };
}

async function loadInsights() {
  try {
    const { data: profile, error: profileError } = await analyticsSupabase
      .from('user_profiles')
      .select('productivity_score, study_streak')
      .eq('id', currentUser.id)
      .single();

    if (profileError) throw profileError;

    const { stats } = await fetchTaskStats();
    const completionRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0.0';

    document.getElementById('productivityScore').textContent = `${profile.productivity_score || 0}%`;
    document.getElementById('completionRate').textContent = `${completionRate}%`;
    document.getElementById('studyStreak').textContent = profile.study_streak || 0;
    document.getElementById('totalTasks').textContent = stats.total;
  } catch (error) {
    console.error('Error loading insights:', error);
  }
}

async function loadWeeklyProgress() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await analyticsSupabase
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
      return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
          fill: true,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom'
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

async function loadTaskDistribution() {
  try {
    const { stats } = await fetchTaskStats();
    const ctx = document.getElementById('distributionChart').getContext('2d');

    if (distributionChart) {
      distributionChart.destroy();
    }

    distributionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'Pending', 'Overdue'],
        datasets: [{
          data: [stats.completed, stats.pending, stats.overdue],
          backgroundColor: ['#10b981', '#6366f1', '#ef4444'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading task distribution:', error);
  }
}

async function loadPriorityBreakdown() {
  try {
    const { stats } = await fetchTaskStats();
    const ctx = document.getElementById('priorityChart').getContext('2d');

    if (priorityChart) {
      priorityChart.destroy();
    }

    priorityChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['High Priority', 'Medium Priority', 'Low Priority'],
        datasets: [{
          label: 'Number of Tasks',
          data: [stats.byPriority.high, stats.byPriority.medium, stats.byPriority.low],
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(16, 185, 129, 0.8)'
          ],
          borderColor: ['#ef4444', '#f59e0b', '#10b981'],
          borderWidth: 2
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
    console.error('Error loading priority breakdown:', error);
  }
}

async function loadGoals() {
  try {
    const { data, error } = await analyticsSupabase
      .from('goals')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const container = document.getElementById('goalsList');

    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">Target</div><p>No goals set yet. Create your first goal!</p></div>';
      return;
    }

    container.innerHTML = data.map((goal) => `
      <div class="task-item" style="flex-direction: column; align-items: flex-start;">
        <div style="display: flex; width: 100%; align-items: center; gap: 12px;">
          <div class="task-content" style="flex: 1;">
            <div class="task-title">${goal.title}</div>
            ${goal.description ? `<p style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">${goal.description}</p>` : ''}
            <div class="task-meta" style="margin-top: 8px;">
              ${goal.target_date ? `<span>Target: ${formatDate(goal.target_date)}</span>` : ''}
              <span class="priority-badge ${goal.status === 'completed' ? 'priority-low' : 'priority-medium'}">${goal.status}</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            ${goal.status !== 'completed' ? `<button class="btn btn-sm btn-success" onclick="completeGoal('${goal.id}')">Complete</button>` : ''}
            <button class="btn btn-sm btn-danger" onclick="deleteGoal('${goal.id}')">Delete</button>
          </div>
        </div>
        <div style="width: 100%; margin-top: 12px;">
          <div style="background: var(--border-color); height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: var(--success-color); height: 100%; width: ${goal.progress}%; transition: width 0.3s;"></div>
          </div>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Progress: ${goal.progress}%</p>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading goals:', error);
  }
}

function openGoalModal() {
  document.getElementById('goalModal').classList.add('active');
}

function closeGoalModal() {
  document.getElementById('goalModal').classList.remove('active');
  document.getElementById('goalForm').reset();
}

async function handleGoalSubmit(e) {
  e.preventDefault();

  const goalData = {
    user_id: currentUser.id,
    title: document.getElementById('goalTitle').value,
    description: document.getElementById('goalDescription').value,
    target_date: document.getElementById('goalTargetDate').value || null
  };

  try {
    const { error } = await analyticsSupabase
      .from('goals')
      .insert([goalData]);

    if (error) throw error;

    showNotification('Goal created successfully!', 'success');
    closeGoalModal();
    await loadGoals();
  } catch (error) {
    console.error('Error creating goal:', error);
    showNotification('Failed to create goal', 'error');
  }
}

async function completeGoal(goalId) {
  try {
    const { error } = await analyticsSupabase
      .from('goals')
      .update({ status: 'completed', progress: 100 })
      .eq('id', goalId);

    if (error) throw error;

    const { error: rewardError } = await analyticsSupabase
      .from('rewards')
      .insert([{
        user_id: currentUser.id,
        badge_name: 'Goal Achiever',
        badge_type: 'milestone',
        description: 'Completed a goal'
      }]);

    if (rewardError) throw rewardError;

    showNotification('Goal completed!', 'success');
    await loadGoals();
  } catch (error) {
    console.error('Error completing goal:', error);
    showNotification('Failed to complete goal', 'error');
  }
}

async function deleteGoal(goalId) {
  if (!confirm('Are you sure you want to delete this goal?')) return;

  try {
    const { error } = await analyticsSupabase
      .from('goals')
      .delete()
      .eq('id', goalId);

    if (error) throw error;

    showNotification('Goal deleted successfully!', 'success');
    await loadGoals();
  } catch (error) {
    console.error('Error deleting goal:', error);
    showNotification('Failed to delete goal', 'error');
  }
}

init();

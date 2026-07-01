const tasksSupabase = window.supabaseClient;
let currentUser = null;
let allTasks = [];
let currentFilter = 'all';

async function init() {
  currentUser = await checkAuth();
  if (!currentUser) return;

  await Promise.all([loadTasks(), loadSchedule()]);

  document.getElementById('taskForm').addEventListener('submit', handleTaskSubmit);
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await tasksSupabase.auth.signOut();
    window.goToAppPage('index.html');
  });
}

async function loadTasks() {
  try {
    const sortBy = document.getElementById('sortBy').value;
    let orderColumn = 'deadline';

    if (sortBy === 'priority') {
      orderColumn = 'priority';
    } else if (sortBy === 'created') {
      orderColumn = 'created_at';
    }

    const { data, error } = await tasksSupabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order(orderColumn, { ascending: sortBy !== 'priority' });

    if (error) throw error;

    allTasks = data;
    renderTasks();
  } catch (error) {
    console.error('Error loading tasks:', error);
    showNotification('Failed to load tasks', 'error');
  }
}

function renderTasks() {
  const container = document.getElementById('tasksList');
  let filteredTasks = allTasks;

  if (currentFilter !== 'all') {
    filteredTasks = allTasks.filter((task) => task.status === currentFilter);
  }

  if (filteredTasks.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">[]</div><p>No tasks found</p></div>';
    return;
  }

  container.innerHTML = filteredTasks.map((task) => {
    const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';

    return `
      <div class="task-item" style="flex-direction: column; align-items: flex-start;">
        <div style="display: flex; width: 100%; align-items: center; gap: 12px;">
          <input
            type="checkbox"
            class="task-checkbox"
            ${task.status === 'completed' ? 'checked' : ''}
            onchange="toggleTaskStatus('${task.id}', this.checked)"
          >
          <div class="task-content" style="flex: 1;">
            <div class="task-title" style="${task.status === 'completed' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
              ${task.title}
            </div>
            ${task.description ? `<p style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">${task.description}</p>` : ''}
            <div class="task-meta" style="margin-top: 8px;">
              <span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span>
              <span>${formatDate(task.deadline)}</span>
              <span>${getTimeUntilDeadline(task.deadline)}</span>
              ${isOverdue ? '<span style="color: var(--danger-color); font-weight: 600;">Overdue</span>' : ''}
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-secondary" onclick="editTask('${task.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTask('${task.id}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterTasks(filter) {
  currentFilter = filter;
  renderTasks();
}

function openTaskModal(taskId = null) {
  const modal = document.getElementById('taskModal');
  const form = document.getElementById('taskForm');

  form.reset();
  document.getElementById('taskId').value = '';
  document.getElementById('modalTitle').textContent = 'Create New Task';

  if (taskId) {
    const task = allTasks.find((item) => item.id === taskId);
    if (task) {
      document.getElementById('taskId').value = task.id;
      document.getElementById('taskTitle').value = task.title;
      document.getElementById('taskDescription').value = task.description || '';
      document.getElementById('taskDeadline').value = new Date(task.deadline).toISOString().slice(0, 16);
      document.getElementById('taskPriority').value = task.priority;
      document.getElementById('modalTitle').textContent = 'Edit Task';
    }
  }

  modal.classList.add('active');
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('active');
}

async function handleTaskSubmit(e) {
  e.preventDefault();

  const taskId = document.getElementById('taskId').value;
  const taskData = {
    title: document.getElementById('taskTitle').value,
    description: document.getElementById('taskDescription').value,
    deadline: new Date(document.getElementById('taskDeadline').value).toISOString(),
    priority: document.getElementById('taskPriority').value
  };

  try {
    if (taskId) {
      const { error } = await tasksSupabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskId);

      if (error) throw error;
      showNotification('Task updated successfully!', 'success');
    } else {
      const { error } = await tasksSupabase
        .from('tasks')
        .insert([{ ...taskData, user_id: currentUser.id }]);

      if (error) throw error;
      showNotification('Task created successfully!', 'success');
    }

    closeTaskModal();
    await Promise.all([loadTasks(), loadSchedule()]);
  } catch (error) {
    console.error('Error saving task:', error);
    showNotification('Failed to save task', 'error');
  }
}

function editTask(taskId) {
  openTaskModal(taskId);
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;

  try {
    const { error } = await tasksSupabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;

    showNotification('Task deleted successfully!', 'success');
    await Promise.all([loadTasks(), loadSchedule()]);
  } catch (error) {
    console.error('Error deleting task:', error);
    showNotification('Failed to delete task', 'error');
  }
}

async function updateStudyStreak() {
  const { data: profile, error: profileError } = await tasksSupabase
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

  const { error: updateError } = await tasksSupabase
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
    client: tasksSupabase,
    userId: currentUser.id
  });

  return badgeSync.awarded || [];
}

async function toggleTaskStatus(taskId, completed) {
  try {
    const { error } = await tasksSupabase
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

    await Promise.all([loadTasks(), loadSchedule()]);
  } catch (error) {
    console.error('Error toggling task:', error);
    showNotification('Failed to update task', 'error');
  }
}

async function generateSchedule() {
  try {
    showNotification('Generating study schedule...', 'info');

    const { data: tasks, error: tasksError } = await tasksSupabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('status', 'pending')
      .order('deadline', { ascending: true });

    if (tasksError) throw tasksError;

    const { error: clearError } = await tasksSupabase
      .from('study_schedule')
      .delete()
      .eq('user_id', currentUser.id);

    if (clearError) throw clearError;

    const priorityWeight = { High: 3, Medium: 2, Low: 1 };
    const sortedTasks = [...tasks].sort((a, b) => {
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.deadline) - new Date(b.deadline);
    });

    const schedule = [];
    const startDate = new Date();
    let currentDay = 0;
    let dailyHours = 0;
    const maxDailyHours = 6;

    sortedTasks.forEach((task) => {
      const taskHours = priorityWeight[task.priority] || 1;
      if (dailyHours + taskHours > maxDailyHours) {
        currentDay += 1;
        dailyHours = 0;
      }

      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + currentDay);

      const hour = String(9 + dailyHours).padStart(2, '0');

      schedule.push({
        user_id: currentUser.id,
        task_id: task.id,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        scheduled_time: `${hour}:00:00`,
        duration_minutes: taskHours * 60
      });

      dailyHours += taskHours;
    });

    if (schedule.length > 0) {
      const { error: insertError } = await tasksSupabase
        .from('study_schedule')
        .insert(schedule);

      if (insertError) throw insertError;
    }

    await loadSchedule();
    showNotification('Study schedule generated successfully!', 'success');
  } catch (error) {
    console.error('Error generating schedule:', error);
    showNotification('Failed to generate schedule', 'error');
  }
}

async function loadSchedule() {
  try {
    const { data, error } = await tasksSupabase
      .from('study_schedule')
      .select('*, tasks (title, priority)')
      .eq('user_id', currentUser.id)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    const container = document.getElementById('studySchedule');

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">[]</div><p>Click "Generate Schedule" to create your study plan</p></div>';
      return;
    }

    const scheduleByDate = {};
    data.forEach((item) => {
      if (!scheduleByDate[item.scheduled_date]) {
        scheduleByDate[item.scheduled_date] = [];
      }
      scheduleByDate[item.scheduled_date].push(item);
    });

    container.innerHTML = Object.entries(scheduleByDate).map(([date, items]) => `
      <div style="margin-bottom: 24px;">
        <h4 style="margin-bottom: 12px; color: var(--primary-color);">${formatDate(date)}</h4>
        ${items.map((item) => `
          <div class="task-item">
            <div class="task-content">
              <div class="task-title">${item.tasks?.title || 'Task'}</div>
              <div class="task-meta">
                <span>${item.scheduled_time.slice(0, 5)}</span>
                <span>${item.duration_minutes} minutes</span>
                <span class="priority-badge priority-${(item.tasks?.priority || 'medium').toLowerCase()}">${item.tasks?.priority || 'Medium'}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading schedule:', error);
    showNotification('Failed to load study schedule', 'error');
  }
}

init();

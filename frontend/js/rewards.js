const rewardsSupabase = window.supabaseClient;
let currentUser = null;
let currentBadgeResults = [];

async function initRewardsPage() {
  currentUser = await checkAuth();
  if (!currentUser) return;

  try {
    const badgeSync = await window.syncEarnedBadges({
      client: rewardsSupabase,
      userId: currentUser.id
    });
    currentBadgeResults = badgeSync.badges;
  } catch (error) {
    console.error('Error syncing badges:', error);
  }

  await Promise.all([loadRewardProfile(), loadRewardsPage()]);

  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await rewardsSupabase.auth.signOut();
    window.goToAppPage('index.html');
  });
}

async function loadRewardProfile() {
  try {
    const { data, error } = await rewardsSupabase
      .from('user_profiles')
      .select('reward_points')
      .eq('id', currentUser.id)
      .single();

    if (error) throw error;

    document.getElementById('rewardPoints').textContent = data.reward_points || 0;
  } catch (error) {
    console.error('Error loading reward profile:', error);
  }
}

async function loadRewardsPage() {
  try {
    const { data, error } = await rewardsSupabase
      .from('rewards')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('earned_at', { ascending: false });

    if (error) throw error;

    renderRewardSummary(data);
    renderFeaturedReward(data);
    renderRewardBreakdown(data);
    await renderRewardsList(data);
  } catch (error) {
    console.error('Error loading rewards:', error);
  }
}

function renderRewardSummary(rewards) {
  const streakCount = rewards.filter((reward) => reward.badge_type === 'streak').length;
  const latestReward = rewards[0];

  document.getElementById('totalRewards').textContent = rewards.length;
  document.getElementById('streakRewards').textContent = streakCount;
  document.getElementById('latestRewardDate').textContent = latestReward ? formatDate(latestReward.earned_at) : '-';
}

function renderFeaturedReward(rewards) {
  const container = document.getElementById('featuredReward');
  const latestReward = rewards[0];

  if (!latestReward) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">Wins</div><p>Your next completed task can unlock the first reward.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="reward-highlight-label">Latest Achievement</div>
    <div class="reward-highlight-title">${latestReward.badge_name}</div>
    <p class="reward-highlight-text">${latestReward.description || 'A new achievement has been added to your profile.'}</p>
    <div class="task-meta">
      <span class="priority-badge priority-low">${formatRewardType(latestReward.badge_type)}</span>
      <span>Earned ${formatDate(latestReward.earned_at)}</span>
    </div>
  `;
}

function renderRewardBreakdown(rewards) {
  const container = document.getElementById('rewardBreakdown');
  const rewardTypes = [
    { key: 'streak', label: 'Streak badges' },
    { key: 'completion', label: 'Completion badges' },
    { key: 'productivity', label: 'Productivity badges' },
    { key: 'milestone', label: 'Milestone badges' }
  ];

  if (rewards.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">Stats</div><p>Badge totals will appear here once you start earning them.</p></div>';
    return;
  }

  container.innerHTML = rewardTypes.map((type) => {
    const count = rewards.filter((reward) => reward.badge_type === type.key).length;

    return `
      <div class="reward-summary-item">
        <div>
          <strong>${type.label}</strong>
          <div class="reward-type-note">${count === 0 ? 'No badges yet' : 'Unlocked so far'}</div>
        </div>
        <div class="stat-value" style="font-size: 1.6rem; margin-bottom: 0;">${count}</div>
      </div>
    `;
  }).join('');
}

async function renderRewardsList(rewards) {
  const container = document.getElementById('rewardsList');

  if (currentBadgeResults.length === 0) {
    try {
      currentBadgeResults = await window.evaluateBadgeProgress(rewardsSupabase, currentUser.id);
    } catch (error) {
      console.error('Error evaluating badges:', error);
    }
  }

  const earnedDateByName = new Map(rewards.map((reward) => [reward.badge_name, reward.earned_at]));
  const badgeGallery = currentBadgeResults.length > 0
    ? currentBadgeResults
    : window.BADGE_CATALOG.map((badge) => ({ ...badge, earned: false, progress: 'Not started' }));

  container.innerHTML = `
    <div class="badge-gallery">
      ${badgeGallery.map((badge) => {
        const earnedAt = earnedDateByName.get(badge.name);

        return `
          <div class="badge-card ${badge.earned ? 'earned' : 'locked'}">
            <div class="badge-card-top">
              <div class="reward-icon-badge">${getRewardIcon(badge.badge_type)}</div>
              <span class="badge-status ${badge.earned ? 'earned' : 'locked'}">
                ${badge.earned ? 'Earned' : 'Not earned'}
              </span>
            </div>
            <div class="badge-card-title">${badge.name}</div>
            <p class="reward-description">${badge.description}</p>
            <div class="badge-criteria">${badge.criteria}</div>
            <div class="task-meta">
              <span class="priority-badge priority-low">${formatRewardType(badge.badge_type)}</span>
              <span>${earnedAt ? `Earned ${formatDate(earnedAt)}` : badge.progress}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const extraRewards = rewards.filter((reward) =>
    !badgeGallery.some((badge) => badge.name === reward.badge_name)
  );

  if (extraRewards.length > 0) {
    container.innerHTML += `
      <div class="earned-rewards-list">
        <h3 class="card-title mb-2">Other Earned Rewards</h3>
        ${extraRewards.map((reward) => `
          <div class="task-item">
            <div class="reward-icon-badge">${getRewardIcon(reward.badge_type)}</div>
            <div class="task-content">
              <div class="task-title">${reward.badge_name}</div>
              <p class="reward-description">${reward.description || 'Achievement added to your record.'}</p>
              <div class="task-meta">
                <span class="priority-badge priority-low">${formatRewardType(reward.badge_type)}</span>
                <span>Earned ${formatDate(reward.earned_at)}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

function getRewardIcon(type) {
  if (type === 'streak') return 'Streak';
  if (type === 'completion') return 'Done';
  if (type === 'productivity') return 'Focus';
  return 'Goal';
}

function formatRewardType(type) {
  if (!type) return 'Reward';
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

initRewardsPage();

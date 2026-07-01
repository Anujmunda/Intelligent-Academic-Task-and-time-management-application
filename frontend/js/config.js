const supabaseLib = window.supabase;

const SUPABASE_CONFIG = {
  url: 'https://blfgbosfdvsrvbhjhccq.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZmdib3NmZHZzcnZiaGpoY2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTk1NzUsImV4cCI6MjA5MTU3NTU3NX0.8sIk0GtPerb0erYw6m1zs42CFlJ4mD8s355WK1h7MNM'
};

const API_CONFIG = {
  baseUrl: window.location.protocol === 'file:'
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`
};

window.supabaseClient = null;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.API_CONFIG = API_CONFIG;

function resolveAppPath(path) {
  return new URL(path, window.location.href).toString();
}

function goToAppPage(path) {
  window.location.href = resolveAppPath(path);
}

try {
  if (!supabaseLib || typeof supabaseLib.createClient !== 'function') {
    throw new Error('Supabase library not loaded');
  }

  window.supabaseClient = supabaseLib.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
  );
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
}

async function getCurrentUser() {
  if (!window.supabaseClient) {
    return null;
  }

  try {
    const {
      data: { user },
      error
    } = await window.supabaseClient.auth.getUser();

    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Unexpected error getting current user:', error);
    return null;
  }
}

async function ensureUserProfile(user) {
  if (!user || !window.supabaseClient) {
    return { success: false, reason: 'missing-user' };
  }

  try {
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Student';

    const { data: existingProfile, error: fetchError } = await window.supabaseClient
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existingProfile) {
      return { success: true, profileExists: true };
    }

    const { error: insertError } = await window.supabaseClient
      .from('user_profiles')
      .insert([{
        id: user.id,
        full_name: fullName,
        email: user.email
      }]);

    if (insertError) {
      throw insertError;
    }

    return { success: true, profileExists: false };
  } catch (error) {
    console.error('Failed to ensure user profile:', error);
    return { success: false, error };
  }
}

async function checkAuth() {
  const user = await getCurrentUser();

  if (!user) {
    goToAppPage('index.html');
    return null;
  }

  await ensureUserProfile(user);
  return user;
}

async function apiCall(endpoint, options = {}) {
  const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : { success: response.ok, message: await response.text() };

  if (!response.ok) {
    const message = data.error || data.message || 'Request failed';
    throw new Error(message);
  }

  return data;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTimeUntilDeadline(deadline) {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate - now;

  if (diff < 0) {
    return 'Overdue';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} left`;
  }

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} left`;
  }

  return 'Due soon';
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  const background = type === 'success'
    ? '#10b981'
    : type === 'error'
      ? '#ef4444'
      : '#2563eb';

  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${background};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    max-width: 320px;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

window.checkAuth = checkAuth;
window.getCurrentUser = getCurrentUser;
window.ensureUserProfile = ensureUserProfile;
window.apiCall = apiCall;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.getTimeUntilDeadline = getTimeUntilDeadline;
window.showNotification = showNotification;
window.goToAppPage = goToAppPage;
window.resolveAppPath = resolveAppPath;

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

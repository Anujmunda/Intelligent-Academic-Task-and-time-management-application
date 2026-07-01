const authSupabase = window.supabaseClient;
const notifyAuth = window.showNotification;

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const { data, error } = await authSupabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await window.ensureUserProfile(data.user);
      notifyAuth('Login successful!', 'success');
      setTimeout(() => window.goToAppPage('dashboard.html'), 1000);
    } catch (error) {
      notifyAuth(error.message, 'error');
    }
  });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      notifyAuth('Passwords do not match!', 'error');
      return;
    }

    try {
      const { data: authData, error: authError } = await authSupabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (authError) throw authError;

      if (authData.session && authData.user) {
        await window.ensureUserProfile(authData.user);
      }

      notifyAuth('Account created successfully. If email confirmation is enabled, verify your email before logging in.', 'success');
      setTimeout(() => window.goToAppPage('index.html'), 2000);
    } catch (error) {
      notifyAuth(error.message, 'error');
    }
  });
}

const forgotPassword = document.getElementById('forgotPassword');
if (forgotPassword) {
  forgotPassword.addEventListener('click', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;

    if (!email) {
      notifyAuth('Please enter your email address', 'error');
      return;
    }

    try {
      const { error } = await authSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.resolveAppPath('reset-password.html')
      });

      if (error) throw error;
      notifyAuth('Password reset email sent! Check your inbox.', 'success');
    } catch (error) {
      notifyAuth(error.message, 'error');
    }
  });
}

async function checkExistingSession() {
  try {
    const {
      data: { session },
      error
    } = await authSupabase.auth.getSession();

    if (error) throw error;

    const onAuthPage =
      window.location.pathname.endsWith('/index.html') ||
      window.location.pathname.endsWith('/signup.html') ||
      window.location.pathname === '/' ||
      window.location.pathname.endsWith('/frontend/') ||
      window.location.pathname.endsWith('/frontend/index.html');

    if (session?.user) {
      await window.ensureUserProfile(session.user);
    }

    if (session && onAuthPage) {
      window.goToAppPage('dashboard.html');
    }
  } catch (error) {
    console.error('Session check failed:', error);
  }
}

const resetPasswordForm = document.getElementById('resetPasswordForm');
if (resetPasswordForm) {
  resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (password !== confirmPassword) {
      notifyAuth('Passwords do not match!', 'error');
      return;
    }

    try {
      const { error } = await authSupabase.auth.updateUser({ password });

      if (error) throw error;

      notifyAuth('Password updated successfully!', 'success');
      setTimeout(() => window.goToAppPage('index.html'), 1200);
    } catch (error) {
      notifyAuth(error.message, 'error');
    }
  });
}

checkExistingSession();

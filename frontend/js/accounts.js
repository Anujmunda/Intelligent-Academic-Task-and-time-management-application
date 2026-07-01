const accountsSupabase = window.supabaseClient;
let currentUser = null;
let verifiedRecoveryEmail = '';

async function initAccountsPage() {
  currentUser = await checkAuth();
  if (!currentUser) return;

  await loadAccountInformation();

  document.getElementById('changePasswordForm').addEventListener('submit', handlePasswordChange);
  document.getElementById('sendCodeForm').addEventListener('submit', handleSendVerificationCode);
  document.getElementById('verifyCodeForm').addEventListener('submit', handleVerifyCode);
  document.getElementById('recoveryPasswordForm').addEventListener('submit', handleRecoveryPasswordChange);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

async function loadAccountInformation() {
  try {
    const { data, error } = await accountsSupabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', currentUser.id)
      .single();

    if (error) throw error;

    const fullName = data.full_name || currentUser.user_metadata?.full_name || 'Student';
    const parsedName = parseName(fullName);
    const email = data.email || currentUser.email || '-';

    document.getElementById('accountFirstName').textContent = parsedName.firstName;
    document.getElementById('accountLastName').textContent = parsedName.lastName;
    document.getElementById('accountEmail').textContent = email;
    document.getElementById('recoveryEmail').value = email;
  } catch (error) {
    console.error('Error loading account information:', error);
    showNotification('Failed to load account information', 'error');
  }
}

function parseName(fullName) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) {
    return { firstName: '-', lastName: '-' };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '-' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

async function handlePasswordChange(event) {
  event.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmNewPassword = document.getElementById('confirmNewPassword').value;

  if (newPassword !== confirmNewPassword) {
    showNotification('New passwords do not match', 'error');
    return;
  }

  if (currentPassword === newPassword) {
    showNotification('Choose a different new password', 'error');
    return;
  }

  try {
    const { error: signInError } = await accountsSupabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword
    });

    if (signInError) {
      throw new Error('Current password is incorrect');
    }

    const { error: updateError } = await accountsSupabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) throw updateError;

    showNotification('Password changed successfully', 'success');
    document.getElementById('changePasswordForm').reset();
  } catch (error) {
    console.error('Error changing password:', error);
    showNotification(error.message || 'Failed to change password', 'error');
  }
}

async function handleSendVerificationCode(event) {
  event.preventDefault();

  const emailInput = document.getElementById('recoveryEmail').value.trim().toLowerCase();
  const currentEmail = (currentUser.email || '').trim().toLowerCase();

  if (!emailInput) {
    showNotification('Enter your email address first', 'error');
    return;
  }

  if (emailInput !== currentEmail) {
    showNotification('Enter the email tied to your current account', 'error');
    return;
  }

  try {
    const { error } = await accountsSupabase.auth.signInWithOtp({
      email: emailInput,
      options: {
        shouldCreateUser: false
      }
    });

    if (error) throw error;

    verifiedRecoveryEmail = '';
    updateVerificationStatus('Verification code sent. Check your email inbox.', 'success');
    document.getElementById('recoveryPasswordFields').hidden = true;
    document.getElementById('verificationCode').value = '';
    document.getElementById('recoveryPasswordForm').reset();
    showNotification('Verification code sent', 'success');
  } catch (error) {
    console.error('Error sending verification code:', error);
    updateVerificationStatus(error.message || 'Failed to send verification code', 'error');
    showNotification(error.message || 'Failed to send verification code', 'error');
  }
}

async function handleVerifyCode(event) {
  event.preventDefault();

  const email = document.getElementById('recoveryEmail').value.trim().toLowerCase();
  const code = document.getElementById('verificationCode').value.trim();

  if (!/^\d{6}$/.test(code)) {
    updateVerificationStatus('Enter the 6-digit code from your email.', 'error');
    return;
  }

  try {
    const { error } = await accountsSupabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email'
    });

    if (error) throw error;

    verifiedRecoveryEmail = email;
    document.getElementById('recoveryPasswordFields').hidden = false;
    updateVerificationStatus('Code verified. You can now set a new password.', 'success');
    showNotification('Email verified successfully', 'success');
  } catch (error) {
    console.error('Error verifying code:', error);
    verifiedRecoveryEmail = '';
    document.getElementById('recoveryPasswordFields').hidden = true;
    updateVerificationStatus(error.message || 'Verification failed', 'error');
    showNotification(error.message || 'Verification failed', 'error');
  }
}

async function handleRecoveryPasswordChange(event) {
  event.preventDefault();

  const email = document.getElementById('recoveryEmail').value.trim().toLowerCase();
  const newPassword = document.getElementById('recoveryNewPassword').value;
  const confirmPassword = document.getElementById('recoveryConfirmPassword').value;

  if (verifiedRecoveryEmail !== email) {
    showNotification('Verify your email code before changing the password', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showNotification('New passwords do not match', 'error');
    return;
  }

  try {
    const { error } = await accountsSupabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    verifiedRecoveryEmail = '';
    document.getElementById('recoveryPasswordForm').reset();
    document.getElementById('recoveryPasswordFields').hidden = true;
    document.getElementById('verificationCode').value = '';
    updateVerificationStatus('Password updated after email verification.', 'success');
    showNotification('Password changed successfully', 'success');
  } catch (error) {
    console.error('Error updating password after verification:', error);
    showNotification(error.message || 'Failed to update password', 'error');
  }
}

function updateVerificationStatus(message, state) {
  const status = document.getElementById('verificationStatus');
  status.textContent = message;
  status.className = `verification-status mt-2${state ? ` ${state}` : ''}`;
}

async function handleLogout(event) {
  event.preventDefault();

  try {
    const { error } = await accountsSupabase.auth.signOut();
    if (error) throw error;
    window.goToAppPage('index.html');
  } catch (error) {
    console.error('Error logging out:', error);
  }
}

initAccountsPage();

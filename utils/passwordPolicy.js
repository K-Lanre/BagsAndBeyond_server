const validateAdminPassword = (password) => {
  const value = String(password || '');

  if (value.length < 8) {
    return 'Password must be at least 8 characters';
  }

  if (!/[A-Z]/.test(value)) {
    return 'Password must include at least one uppercase letter';
  }

  if (!/[a-z]/.test(value)) {
    return 'Password must include at least one lowercase letter';
  }

  if (!/[0-9]/.test(value)) {
    return 'Password must include at least one number';
  }

  return null;
};

module.exports = { validateAdminPassword };

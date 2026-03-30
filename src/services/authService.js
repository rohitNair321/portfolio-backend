// services/authService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { JWT, COOKIE } = require('../config/constants');

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Create JWT token
 */
function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT.TOKEN_EXPIRY }
  );
}

/**
 * Login user
 */
async function login(email, password) {
  try {
    // Fetch user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, role, is_active')
      .eq('email', email)
      .single();

    if (error || !user) {
      logger.warn('Login attempt with invalid email', { email });
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.is_active) {
      logger.warn('Login attempt with disabled account', { email });
      throw ApiError.forbidden('Account is disabled');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      logger.warn('Login attempt with invalid password', { email });
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Create token
    const token = createToken(user);

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    logger.error('Login error:', error);
    throw error;
  }
}

/**
 * Initialize app data (for frontend startup)
 */
async function initAppData(user) {
  try {
    const userId = user?.id || PROFILE_OWNER_ID;
    const role = user?.role || 'guest';
    const email = user?.email || null;

    // Fetch profile themes
    const { data } = await supabase
      .from('profiles')
      .select('themes, currenttheme')
      .eq('id', userId)
      .maybeSingle();

    logger.info('App initialized', { userId, role });

    return {
      id: userId,
      role,
      email,
      appData: data || null,
    };
  } catch (error) {
    logger.error('initAppData error:', error);
    throw ApiError.internal('Failed to initialize app data');
  }
}

/**
 * Forgot password - Send reset email
 */
async function forgotPassword(email) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    // Don't reveal if email exists (security)
    if (!user) {
      logger.info('Password reset requested for non-existent email', { email });
      return {
        message: 'If this email exists, reset instructions will be sent.',
      };
    }

    // Create reset token
    const resetToken = jwt.sign(
      { sub: user.id, type: 'password-reset' },
      JWT_SECRET,
      { expiresIn: JWT.RESET_TOKEN_EXPIRY }
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // TODO: Send email using your email service (Resend, SendGrid, etc.)
    // For now, just log it
    logger.info('Password reset requested', {
      userId: user.id,
      email: user.email,
      resetLink,
    });

    return {
      message: 'If this email exists, reset instructions will be sent.',
    };
  } catch (error) {
    logger.error('forgotPassword error:', error);
    throw ApiError.internal('Failed to process password reset request');
  }
}

/**
 * Reset password
 */
async function resetPassword(token, newPassword) {
  try {
    // Verify token
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      if (payload.type !== 'password-reset') {
        throw ApiError.badRequest('Invalid reset token');
      }
    } catch (err) {
      logger.warn('Invalid reset token attempt');
      throw ApiError.badRequest('Reset token expired or invalid');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // Update password
    const { error } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', payload.sub);

    if (error) {
      logger.error('Failed to reset password:', error);
      throw ApiError.internal('Failed to reset password');
    }

    logger.info('Password reset successful', { userId: payload.sub });

    return { message: 'Password reset successful' };
  } catch (error) {
    logger.error('resetPassword error:', error);
    throw error;
  }
}

/**
 * Update password (when user is logged in)
 */
async function updatePassword(email, currentPassword, newPassword) {
  try {
    // Fetch user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('email', email)
      .single();

    if (error || !user) {
      throw ApiError.notFound('User not found');
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      logger.warn('Password update failed - incorrect current password', { email });
      throw ApiError.unauthorized('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to update password:', updateError);
      throw ApiError.internal('Failed to update password');
    }

    logger.info('Password updated successfully', { userId: user.id, email });

    return { message: 'Password updated successfully' };
  } catch (error) {
    logger.error('updatePassword error:', error);
    throw error;
  }
}

/**
 * Logout - Clear cookie
 */
function logout() {
  return { message: 'Logged out successfully' };
}

module.exports = {
  login,
  initAppData,
  forgotPassword,
  resetPassword,
  updatePassword,
  logout,
  createToken,
};

// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/supabaseClient');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '1d';
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Create JWT for admin
 */
function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role // 👈 MUST be explicit
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

async function initAppData(req, res) {
  try {
    const user = req.user;
    const id = user?.id || PROFILE_OWNER_ID;
    const role = user?.role || "guest";
    const email = user?.email || null;

    // Refresh cookie for active sessions
    if (user && user.role !== 'guest') {
      const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
      if (token) {
        res.cookie("token", token, {
          httpOnly: true,
          sameSite: isProduction ? "none" : "lax",
          secure: isProduction,
          maxAge: 24 * 60 * 60 * 1000,
          path: '/'
        });
      }
    }

    const { data } = await supabase
      .from('profiles')
      .select('themes, currenttheme')
      .eq('id', id)
      .maybeSingle();

    return res.status(200).json({ id, role, email});
  } catch (err) {
    console.error('initAppData error:', err);
    return res.status(500).json({ message: 'Unexpected error.' });
  }
}

/**
 * =========================
 * POST /api/auth/login
 * =========================
 * ADMIN ONLY
 */
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, role, is_active')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account is disabled.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Update last login (non-blocking)
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const token = createToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });
    return res.status(200).json({
      message: 'Admin login successful.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token: token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Unexpected error during login.' });
  }
}

/**
 * =========================
 * POST /api/auth/forgot-password
 * =========================
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    // Always return success (prevent enumeration)
    if (!user) {
      return res.status(200).json({
        message: 'If this email exists, reset instructions will be sent.'
      });
    }

    const resetToken = jwt.sign(
      { sub: user.id, type: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const resetLink =
      `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // TODO: Replace with Resend (recommended)
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Reset your admin password',
      html: `
        <p>You requested a password reset.</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link expires in 1 hour.</p>
      `
    });

    return res.status(200).json({
      message: 'If this email exists, reset instructions will be sent.'
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ message: 'Unexpected error.' });
  }
}

/**
 * =========================
 * POST /api/auth/reset-password
 * =========================
 */
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      if (payload.type !== 'password-reset') {
        return res.status(400).json({ message: 'Invalid reset token.' });
      }
    } catch {
      return res.status(400).json({ message: 'Reset token expired or invalid.' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const { error } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', payload.sub);

    if (error) {
      return res.status(500).json({ message: 'Failed to reset password.' });
    }

    return res.status(200).json({ message: 'Password reset successful.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ message: 'Unexpected error.' });
  }
}

async function updatePassword(req, res) {
  try {
    const { email, currentPassword, newPassword } = req.body;
    // 1. Fetch the user's current record from Supabase
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash, email')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ message: "Administrator record not found." });
    }

    // 2. Verify the CURRENT password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password verification failed." });
    }

    // 3. Hash the NEW password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 4. Update Supabase
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date()
      })
      .eq('email', email);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      success: true,
      message: "Credentials updated in secure storage."
    });

  } catch (error) {
    console.error("Password Update Error:", error);
    res.status(500).json({ message: "Internal server error during password update." });
  }
};

async function logout(req, res) {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      path: '/' 
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Logout failed" });
  }
}

module.exports = {
  loginUser,
  forgotPassword,
  resetPassword,
  updatePassword,
  logout,
  initAppData
};

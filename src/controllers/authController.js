// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/supabaseClient');

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

// Helper: generate JWT
function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
}

//#region POST /api/auth/register
async function registerUser(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    // 1. Check if user already exists
    const { data: existingUser, error: existingError } = await supabase
      .from('users')          // 👈 use your actual table name
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existingError) {
      console.error('Supabase error (check existing user):', existingError);
      return res.status(500).json({ message: 'Error checking existing user.' });
    }

    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists.' });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 3. Insert user
    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert({
        name,
        email,
        password_hash: hashedPassword, // 👈 column name from your table
      })
      .select('id, name, email')
      .single();

    if (insertError) {
      console.error('Supabase error (insert user):', insertError);
      return res.status(500).json({ message: 'Error creating user.' });
    }

    // 4. Create token
    const token = createToken(insertedUser);

    return res.status(201).json({
      message: 'User registered successfully.',
      user: insertedUser,
      token,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Unexpected error while registering.' });
  }
}
//#endregion 

//#region POST /api/auth/login
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // 1. Fetch user by email
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError) {
      // If Supabase returns "no rows" it appears as an error
      console.warn('Supabase fetch user error:', fetchError);
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // 3. Create token
    const token = createToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Unexpected error while logging in.' });
  }
}
//#endregion

//#region POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    // 1. Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('Supabase error (forgot password):', error);
      return res.status(500).json({ message: 'Error checking user.' });
    }

    if (!user) {
      // For security, respond with success even if user not found
      return res.status(200).json({ message: 'If this email exists, reset instructions will be sent.' });
    }

    // Generate a reset token (JWT, expires in 1 hour)
    const resetToken = jwt.sign(
      { sub: user.id, email: user.email, type: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create a reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/reset-password?token=${resetToken}`;

    // Send email or log link
    if (process.env.NODE_ENV === 'production') {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.verify((err, success) => {
      if (err) {
        console.error('❌ SMTP connection error:', err.message);
      } else {
        console.log('✅ SMTP server is ready to take messages');
      }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Support" <support@example.com>',
      to: user.email,
      subject: 'Password Reset Instructions',
      html: `
          <p>Hello ${user.name},</p>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
    });
    } else {
      console.log(`[DEV] Password reset link for ${user.email}: ${resetLink}`);
    }

    return res.status(200).json({ status: 'success', message: 'If this email exists, reset instructions will be sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ message: 'Unexpected error while processing request.' });
  }
}
//#endregion

//#region POST /api/auth/reset-password
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }

    // 1. Verify token
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      if (payload.type !== 'password-reset') {
        return res.status(400).json({ message: 'Invalid reset token.' });
      }
    } catch (err) {
      return res.status(400).json({ message: 'Reset token is invalid or expired.' });
    }

    // 2. Find user by ID
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', payload.sub)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // 3. Hash new password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 4. Update password in DB
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', user.id);

    if (updateError) {
      console.error('Supabase error (reset password):', updateError);
      return res.status(500).json({ message: 'Error updating password.' });
    }

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ message: 'Unexpected error while resetting password.' });
  }
}
//#endregion

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword
};

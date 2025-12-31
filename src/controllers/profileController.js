// controllers/profileController.js
const { supabase } = require('../db/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const BUCKET = process.env.ASSET_BUCKET || 'assets';   // <-- updated to single bucket

const JWT_SECRET = process.env.JWT_SECRET;
const RESUME_EXPIRY_SECONDS = Number(process.env.RESUME_SIGNED_URL_EXPIRY || 600);

//#region Helper to parse JSON fields
function parseJsonField(value) {
  if (!value) return undefined;
  if (Array.isArray(value) || typeof value === 'object') {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
  }
  return undefined;
}
// #endregion

//#region JWT setup for public portfolio token
async function token(req, res) {
  try {
    const payload = {
      sub: 'f135bcee-bad6-4634-86e1-36e77760932f',
      role: 'user',
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });

    return res.json({
      success: true,
      token,
    });
  } catch (error) {
    console.error('Portfolio token error:', error);
    return res.status(500).json({ message: 'Failed to generate portfolio token' });
  }
}
//#endregion

//#region Helper to upsert profile row upsertProfileRow
async function upsertProfileRow(userId, payload) {
  if (!userId || userId === 'public-portfolio') {
    throw new Error('Invalid user context for profile write');
  }
  payload.updated_at = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (updateError) throw updateError;

  if (updated) return updated;

  // If no row existed → insert
  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId, ...payload })
    .select()
    .single();

  if (insertError) throw insertError;

  return inserted;
}
//#endregion

//#region GET /api/profile/me getMyProfile
async function getMyProfile(req, res) {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Supabase error fetching profile:', error);
      return res.status(500).json({ message: 'Error fetching profile' });
    }
    return res.json({ profile: data || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Unexpected error' });
  }
}
//#endregion

//#region PUT /api/profile/me updateMyProfile
async function updateMyProfile(req, res) {
  try {
    if (req.user.role === 'public') {
      return res.status(403).json({
        message: 'Public token is read-only. Login required to update profile.'
      });
    }
    const userId = req.user.id;
    console.log('UPDATE PROFILE → req.user:', req.user);
    const {
      name, full_name, description, email, primaryPhone, primary_phone,
      secondaryPhone, secondary_phone, location, website, linkedin, github,
      openToWork, open_to_work, skills, experiences, logo_initials, currenttheme, themes
    } = req.body;

    const payload = {
      full_name: full_name || name || null,
      description: description || null,
      email: email || null,
      primary_phone: primaryPhone || primary_phone || null,
      secondary_phone: secondaryPhone || secondary_phone || null,
      location: location || null,
      website: website || null,
      linkedin: linkedin || null,
      github: github || null,
      logo_initials: logo_initials || null,
      open_to_work:
        openToWork === 'true' ||
        openToWork === true ||
        open_to_work === 'true' ||
        open_to_work === true,
      currenttheme: currenttheme || null,
      themes: parseJsonField(themes),
      skills: parseJsonField(skills),
      experiences: parseJsonField(experiences)
    };

    const files = req.files || {};
    if (files.avatar && files.avatar[0]) {
      const f = files.avatar[0];
      const ext = (f.originalname.split('.').pop() || 'jpg').toLowerCase();

      const avatarPath = `avatars/${userId}/${uuidv4()}.${ext}`;
      const { error: avatarError } = await supabase.storage
        .from(BUCKET)
        .upload(avatarPath, f.buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: f.mimetype,
        });

      if (avatarError) throw avatarError;

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(avatarPath);
      payload.avatar_url = publicData.publicUrl;
    }

    if (files.resume && files.resume[0]) {
      const f = files.resume[0];

      if (f.mimetype !== 'application/pdf' && !f.originalname.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ message: 'Resume must be a PDF' });
      }

      const resumePath = `resumes/${userId}/${uuidv4()}.pdf`;

      const { error: resumeError } = await supabase.storage
        .from(BUCKET)
        .upload(resumePath, f.buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: f.mimetype,
        });

      if (resumeError) throw resumeError;
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(resumePath);
      payload.resume_url = publicData.publicUrl;
    }

    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const saved = await upsertProfileRow(userId, payload);

    return res.json({ profile: saved });
  } catch (err) {
    console.error('updateMyProfile error', err);
    return res.status(500).json({ message: 'Error updating profile', details: err.message || err });
  }
}
//#endregion

//#region GET /api/profile/me/resume downloadResume
async function downloadResume(req, res) {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('resume_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.resume_url) {
      return res.status(404).json({ message: 'No resume available' });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.resume_url, RESUME_EXPIRY_SECONDS);

    if (signedError) throw signedError;

    return res.json({ url: signed.signedURL, expires_in: RESUME_EXPIRY_SECONDS });
  } catch (err) {
    console.error('downloadResume error', err);
    return res.status(500).json({ message: 'Error creating signed url', details: err.message || err });
  }
}
// #endregion

module.exports = {
  token,
  getMyProfile,
  updateMyProfile,
  downloadResume
};

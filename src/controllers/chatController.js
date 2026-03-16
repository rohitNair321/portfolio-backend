const express = require("express");
const router = express.Router();
const { supabase } = require('../db/supabaseClient');
const { askAI } = require("../services/aiService");
const { checkGuestLimit } = require("../helper/limite");
const e = require("express");
const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;

async function chat(req, res) {
  try {

    const { message, sessionId, userId, role } = req.body;
    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress;

    const isAdmin = role === "ADMIN";

    if (!isAdmin) {

      const count = await checkGuestLimit(ip);

      if (count >= 5) {

        return res.json({
          limitReached: true,
          message:
            "Limit reached. Please contact Rohit using contact section."
        });

      }

    }

    const reply = await askAI(message);

    let session = null;

    // -------------------------
    // 1. If session exists
    // -------------------------

    if (sessionId) {

      const { data } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      session = data;

    }

    // -------------------------
    // 2. If no session → create
    // -------------------------

    if (!session) {

      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          title: message.slice(0, 30),
          model: "o4-mini",
          role: isAdmin ? "admin" : "guest",
          is_guest: isAdmin ? false : true,
          user_id: userId,
          user_ip: ip,
          messages: []
        })
        .select()
        .single();

      if (error) throw error;

      session = data;

    }

    // -------------------------
    // 3. append messages
    // -------------------------

    const messages = session.messages || [];

    messages.push({
      sender: "user",
      text: message,
      time: new Date()
    });

    messages.push({
      sender: "bot",
      text: reply,
      time: new Date()
    });

    // -------------------------
    // 4. update session
    // -------------------------

    await supabase
      .from("chat_sessions")
      .update({
        messages,
        updated_at: new Date()
      })
      .eq("id", session.id);

    res.json({
      response: reply,
      sessionId: session.id
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "AI error"
    });

  }

}

async function createSession(req, res) {
  try {

    const { title, model, userId } = req.body;

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        title,
        model,
        user_id: userId
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json(err.message);
  }
}

async function saveMessage(req, res) {
  try {

    const { sessionId, sender, message, userId } = req.body;

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        sender,
        message,
        user_id: userId
      })
      .select();

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json(err.message);
  }
}

async function getSession(req, res) {
  try {

    const id = req.params.id;

    if (!id) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return res.json(null);

    res.json(data);

  } catch (err) {
    console.error(err);
    return res.json([]);
  }

}

async function getSessions(req, res) {
  try {
    const userId = PROFILE_OWNER_ID;

    const role = req.user?.role || "guest";

    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown";
    let query = supabase
      .from("chat_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (role === "admin") {
      query = query.eq("user_id", userId);
      // no filter
    } else if (role === "guest") {
      query = query
        .eq("is_guest", true)
        .eq("user_ip", ip)
        .eq("user_id", userId);
    }

    const { data, error } = await query;


    if (error) return res.json([]);

    res.json(data || []);

  } catch (err) {

    console.error(err);

    return res.json([]);

  }
}

async function deleteSession(req, res) {

  const id = req.params.id;

  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);

  res.json({ success: true });
}

async function deleteAllSessions(req, res) {
  const isAdmin = req.user?.role === "admin";

  if (!isAdmin) {
    return res.status(403).json({
      message: "Admin only"
    });
  }

  await supabase
    .from("chat_sessions")
    .delete()
    .not("id", "is", null);

  res.json({ success: true });
}

module.exports = { chat, createSession, saveMessage, getSession, getSessions, deleteSession, deleteAllSessions };
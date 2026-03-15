const { supabase } = require('../db/supabaseClient');

async function checkGuestLimit(ip) {
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("is_guest", true)
    .eq("user_ip", ip)
    .gte("created_at", since.toISOString());

  if (error) {
    console.log("limit error", error);
    return 0;
  }

  return data.length;
}


module.exports = {checkGuestLimit};
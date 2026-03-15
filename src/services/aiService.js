const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are AiNg, assistant of Rohit's portfolio website.

You must answer ONLY about:
- Rohit
- his portfolio web app
- Angular project structure
- versions
- backend Node API
- Supabase
- UI grid layout
- SSR
- features of the site

If question is unrelated, say:
"I can only answer about Rohit's portfolio."
`;

async function askAI(message) {
  const response = await client.responses.create({
    model: "o4-mini",
    input: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: message,
      },
    ],
  });

  return response.output_text;
}

module.exports = { askAI };
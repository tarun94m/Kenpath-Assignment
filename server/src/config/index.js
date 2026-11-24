// All settings and business constants in one place.
const env = process.env;
const model = env.OLLAMA_MODEL || 'gemma3:4b'; // better Kannada than llama3.2; run: ollama pull gemma3:4b

export const config = {
  port: Number(env.API_PORT) || 4000,
  databaseUrl: env.DATABASE_URL || 'postgres://postgres:pw@127.0.0.1:5439/sandhya',
  ollamaUrl: env.OLLAMA_URL || 'http://127.0.0.1:11434',
  model,
  visionModel: env.VISION_MODEL || model, // must accept images (gemma3 does)
  secret: env.SECRET || 'change-me-in-production',
  smsWebhookUrl: env.SMS_WEBHOOK_URL || '',
  stageRole: { 1: 'gao', 2: 'ri', 3: 'tahsildar' }, // who owns each step
  rules: { minAge: 65, maxIncome: 20000 }, // Sandhya Suraksha criteria - verify against the current GO
};

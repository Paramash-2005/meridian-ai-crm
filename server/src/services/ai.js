const { z } = require('zod');

const isLive = () => Boolean(process.env.OPENAI_API_KEY);

let _chatModel = null;
function getChatModel() {
  if (_chatModel) return _chatModel;
  const { ChatOpenAI } = require('@langchain/openai');
  _chatModel = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
  });
  return _chatModel;
}

const scoreSchema = z.object({
  score: z.number().min(0).max(100).describe('Lead quality score from 0 (cold) to 100 (very hot)'),
  rationale: z.string().describe('One or two sentence explanation of the score, written for a sales rep'),
});

const sentimentSchema = z.object({
  label: z.enum(['positive', 'neutral', 'negative']),
  confidence: z.number().min(0).max(1),
});

// --- Deterministic mock provider: no API key needed, no network calls, no cost. ---

function seededScore(lead) {
  let hash = 0;
  const key = `${lead.name}|${lead.company}|${lead.source}|${lead.value}`;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;

  let score = 35 + (hash % 40); // 35-74 baseline
  if (lead.value > 5000) score += 12;
  if (lead.value > 20000) score += 8;
  if (['Referral', 'Event'].includes(lead.source)) score += 10;
  if (lead.company) score += 5;
  score = Math.max(1, Math.min(99, Math.round(score)));

  const drivers = [];
  if (lead.value > 5000) drivers.push('a sizeable deal value');
  if (['Referral', 'Event'].includes(lead.source)) drivers.push(`a strong source (${lead.source})`);
  if (lead.company) drivers.push('an identified company');
  const rationale = drivers.length
    ? `Scored ${score}/100 based on ${drivers.join(' and ')}.`
    : `Scored ${score}/100 based on limited information available so far.`;

  return { score, rationale };
}

const POSITIVE_WORDS = ['great', 'excited', 'love', 'interested', 'happy', 'perfect', 'yes', 'thanks', 'awesome'];
const NEGATIVE_WORDS = ['not interested', 'too expensive', 'no', 'cancel', 'disappointed', 'unhappy', 'stop', 'never'];

function keywordSentiment(text) {
  const lower = text.toLowerCase();
  const positiveHits = POSITIVE_WORDS.filter((w) => lower.includes(w)).length;
  const negativeHits = NEGATIVE_WORDS.filter((w) => lower.includes(w)).length;

  if (negativeHits > positiveHits) return { label: 'negative', confidence: 0.6 + Math.min(0.3, negativeHits * 0.1) };
  if (positiveHits > negativeHits) return { label: 'positive', confidence: 0.6 + Math.min(0.3, positiveHits * 0.1) };
  return { label: 'neutral', confidence: 0.55 };
}

function mockAutoReply(lead) {
  const firstName = (lead.name || '').split(' ')[0] || 'there';
  return (
    `Hi ${firstName},\n\n` +
    `Thank you for your interest${lead.company ? ` on behalf of ${lead.company}` : ''} — it's great to connect. ` +
    `I'd love to learn a bit more about what you're looking for and see how we can help.\n\n` +
    `Would you have 15 minutes this week for a quick call?\n\n` +
    `Best regards`
  );
}

// --- Public API ---

async function scoreLead(lead) {
  if (!isLive()) return { ...seededScore(lead), mock: true };

  try {
    const model = getChatModel().withStructuredOutput(scoreSchema);
    const result = await model.invoke([
      ['system', 'You are a sales operations assistant that scores inbound CRM leads for quality (0-100) and gives a short rationale for a sales rep.'],
      [
        'human',
        `Score this lead:\nName: ${lead.name}\nCompany: ${lead.company || 'unknown'}\nSource: ${lead.source}\nEstimated deal value: $${lead.value || 0}\nRecent notes: ${(lead.notes || []).slice(-3).map((n) => n.text).join(' | ') || 'none'}`,
      ],
    ]);
    return { ...result, mock: false };
  } catch (err) {
    console.error('AI scoreLead failed, falling back to mock:', err.message);
    return { ...seededScore(lead), mock: true };
  }
}

async function analyzeSentiment(text) {
  if (!isLive()) return { ...keywordSentiment(text), mock: true };

  try {
    const model = getChatModel().withStructuredOutput(sentimentSchema);
    const result = await model.invoke([
      ['system', 'Classify the sentiment of this CRM note as positive, neutral, or negative, with a confidence from 0 to 1.'],
      ['human', text],
    ]);
    return { ...result, mock: false };
  } catch (err) {
    console.error('AI analyzeSentiment failed, falling back to mock:', err.message);
    return { ...keywordSentiment(text), mock: true };
  }
}

async function generateAutoReply(lead) {
  if (!isLive()) return { reply: mockAutoReply(lead), mock: true };

  try {
    const model = getChatModel();
    const result = await model.invoke([
      ['system', 'You draft short, warm, professional first-touch sales emails for a CRM. Keep it under 120 words, no subject line.'],
      [
        'human',
        `Draft a reply to this lead:\nName: ${lead.name}\nCompany: ${lead.company || 'unknown'}\nSource: ${lead.source}\nRecent notes: ${(lead.notes || []).slice(-3).map((n) => n.text).join(' | ') || 'none'}`,
      ],
    ]);
    return { reply: result.content, mock: false };
  } catch (err) {
    console.error('AI generateAutoReply failed, falling back to mock:', err.message);
    return { reply: mockAutoReply(lead), mock: true };
  }
}

module.exports = { isLive, scoreLead, analyzeSentiment, generateAutoReply };

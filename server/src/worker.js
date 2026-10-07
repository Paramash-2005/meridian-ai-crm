require('dotenv').config();
const { connectDB } = require('./config/db');
const { aiQueue } = require('./queues/aiQueue');
require('./models/User'); // registers the 'User' ref target used by Lead.populate('assignedTo')
const Lead = require('./models/Lead');
const ai = require('./services/ai');
const { publishEvent } = require('./socket/publish');

function rooms(lead) {
  return ['role:admin', lead.assignedTo ? `user:${lead.assignedTo}` : null].filter(Boolean);
}

async function main() {
  await connectDB();
  console.log(`AI worker online (mode: ${ai.isLive() ? 'live OpenAI' : 'mock'}) — waiting for jobs...`);

  aiQueue.process('score', async (job) => {
    const { leadId } = job.data;
    const lead = await Lead.findById(leadId);
    if (!lead) return;

    const { score, rationale, mock } = await ai.scoreLead(lead);
    lead.ai = { score, rationale, status: 'done', scoredAt: new Date(), mock };
    lead.activities.push({ type: 'ai-scored', message: `AI scored this lead ${score}/100${mock ? ' (mock)' : ''}` });
    await lead.save();

    const populated = await lead.populate('assignedTo', 'name email role');
    publishEvent('lead:scored', populated.toJSON(), rooms(lead));
  });

  aiQueue.process('sentiment', async (job) => {
    const { leadId, noteId } = job.data;
    const lead = await Lead.findById(leadId);
    if (!lead) return;
    const note = lead.notes.id(noteId);
    if (!note) return;

    const { label, confidence, mock } = await ai.analyzeSentiment(note.text);
    note.sentiment = { label, confidence };
    await lead.save();

    publishEvent('lead:note-scored', { leadId: lead.id, noteId, sentiment: { label, confidence }, mock }, rooms(lead));
  });

  aiQueue.on('failed', async (job, err) => {
    console.error(`Job ${job.name} (lead ${job.data.leadId}) failed:`, err.message);
    if (job.name === 'score' && job.attemptsMade >= job.opts.attempts) {
      await Lead.findByIdAndUpdate(job.data.leadId, { 'ai.status': 'failed' });
    }
  });
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});

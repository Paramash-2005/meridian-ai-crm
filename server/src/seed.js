require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB } = require('./config/db');
const User = require('./models/User');
const Lead = require('./models/Lead');
const { aiQueue } = require('./queues/aiQueue');
const mongoose = require('mongoose');

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260918);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const SOURCES = ['Website', 'Referral', 'Cold Call', 'Event', 'Advertising', 'Other'];
const COMPANIES = [
  'Northbridge Logistics', 'Vantage Materials Group', 'Halstead & Fox Consulting', 'Ridgeline Manufacturing',
  'Cascadia Freight Co.', 'BrightPath Analytics', 'Ferro Industrial Supply', 'Summit Legal Partners',
  'Hearthstone Property Group', 'Calloway Insurance Brokers', 'Tidal Wave Software', 'Ironclad Security Systems',
  'Merchant & Wells Retail', 'Oakmont Financial Advisors', 'Pinnacle HR Solutions', 'Delta Grid Energy',
  'Silverline Telecom', 'Anchor Point Logistics',
];
const FIRST_NAMES = ['Daniel', 'Sofia', 'Marcus', 'Elena', 'Theo', 'Naomi', 'Victor', 'Camille', 'Owen', 'Priya', 'Isaac', 'Lucia', 'Nadia', 'Felix', 'Grace', 'Adrian', 'Yusuf', 'Ines'];
const LAST_NAMES = ['Reyes', 'Whitfield', 'Bergman', 'Okonkwo', 'Marsh', 'Delacroix', 'Halvorsen', 'Bianchi', 'Fitzgerald', 'Novak', 'Sato', 'Abara', 'Lindqvist', 'Moreau', 'Castillo'];

const NOTE_TEMPLATES = [
  'Had a great intro call — they are excited about rolling this out company-wide.',
  'Requested pricing for the enterprise tier, seems price sensitive.',
  'Not interested right now, budget was cut this quarter.',
  'Very responsive over email, loved the demo.',
  'Asked for a follow-up next month, timing is not right yet.',
  'Decision maker is on board, just needs procurement sign-off.',
  'Concerned about the implementation timeline, seemed a bit frustrated.',
  'Thanks for the quick turnaround — really impressed with the team so far.',
];

const WITH_DEMO_LEADS = process.argv.includes('--demo-leads');

async function main() {
  await connectDB();

  await Promise.all([User.deleteMany({}), Lead.deleteMany({})]);
  await aiQueue.empty();

  const users = await User.insertMany([
    { name: 'Meredith Alcott', email: 'admin@meridiancrm.com', passwordHash: bcrypt.hashSync('Admin@123', 10), role: 'admin' },
    { name: 'James Okafor', email: 'james@meridiancrm.com', passwordHash: bcrypt.hashSync('Sales@123', 10), role: 'sales-rep' },
    { name: 'Priya Anand', email: 'priya@meridiancrm.com', passwordHash: bcrypt.hashSync('Sales@123', 10), role: 'sales-rep' },
  ]);

  console.log(`Seed complete — ${users.length} users created, leads table left empty.`);
  console.log('Logins:');
  console.log('  admin@meridiancrm.com / Admin@123 (admin)');
  console.log('  james@meridiancrm.com / Sales@123 (sales-rep)');
  console.log('  priya@meridiancrm.com / Sales@123 (sales-rep)');

  if (!WITH_DEMO_LEADS) {
    await mongoose.disconnect();
    await aiQueue.close();
    return process.exit(0);
  }

  const [admin, james, priya] = users;
  const reps = [james, priya];

  const now = new Date();
  const leadsToInsert = [];

  for (let i = 0; i < 24; i++) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const company = pick(COMPANIES);
    const source = pick(SOURCES);
    const status = pick(STATUSES);
    const value = randInt(2, 150) * 1000;
    const daysAgo = randInt(0, 120);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const assignedTo = rand() < 0.15 ? null : pick(reps)._id;
    const noteCount = randInt(0, 3);
    const notes = Array.from({ length: noteCount }, () => ({
      text: pick(NOTE_TEMPLATES),
      author: assignedTo || admin._id,
      createdAt: new Date(createdAt.getTime() + randInt(1, 5) * 24 * 60 * 60 * 1000),
    }));

    leadsToInsert.push({
      name,
      email: `${name.split(' ')[0].toLowerCase()}.${name.split(' ')[1].toLowerCase()}@${company.split(' ')[0].toLowerCase()}.example`,
      phone: `(4${randInt(10, 99)}) 555-${String(randInt(1000, 9999))}`,
      company,
      source,
      status,
      value,
      assignedTo,
      createdBy: admin._id,
      createdAt,
      updatedAt: createdAt,
      notes,
      activities: [{ type: 'created', message: 'Lead created during demo seeding', createdAt }],
    });
  }

  const inserted = await Lead.insertMany(leadsToInsert);
  for (const lead of inserted) {
    await aiQueue.add('score', { leadId: lead.id });
  }

  console.log(`Added ${inserted.length} demo leads (AI scoring jobs queued — start the worker to process them).`);

  await mongoose.disconnect();
  await aiQueue.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

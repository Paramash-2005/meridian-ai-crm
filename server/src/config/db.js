const dns = require('dns');
const mongoose = require('mongoose');

// Optional: override Node's DNS servers (e.g. DNS_SERVERS=8.8.8.8,1.1.1.1) when the local
// resolver is broken and `mongodb+srv://` lookups fail with querySrv ECONNREFUSED.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
}

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB connected -> ${mongoose.connection.name}`);
}

module.exports = { connectDB };

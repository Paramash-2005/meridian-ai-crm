# Meridian CRM — client

React + Vite + Tailwind CSS single-page app for Meridian CRM. See the [root README](../README.md)
for the architecture overview, demo logins and deployment notes.

```bash
npm install
npm run dev     # http://localhost:5173, proxies /api and /socket.io to the API on :4000
npm run lint
npm run build
```

Source layout: `src/pages` (Login, Dashboard, Leads, Team), `src/components`, `src/context`
(auth + Socket.io), `src/api.js` (fetch wrapper).

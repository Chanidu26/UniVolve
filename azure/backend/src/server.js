require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
app.use(cors({ origin: (process.env.ALLOWED_ORIGINS || '*').split(',') }));
app.use(express.json());
app.get('/health', (_, res) => res.json({ status: 'ok' }));  // Container Apps probe
app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`VMS backend (Azure) on :${port}`));

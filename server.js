const express = require('express');
const path = require('path');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', routes);
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Shopify Spy running at http://localhost:${PORT}`);
});

import app from './app.js';

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`API Champi sur http://localhost:${PORT}`));

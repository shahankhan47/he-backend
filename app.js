const express = require('express');
const cors = require('cors');
const userRoutes = require('./app/routes/user.routes');
const authRoutes = require('./app/routes/auth.routes');
const pinRoutes = require('./app/routes/pin.routes');
const diagramRoutes = require('./app/routes/diagram.routes');
const projectRoutes = require('./app/routes/projects.routes');
const messagesRoutes = require('./app/routes/messages.routes');
const summaryRoutes = require('./app/routes/summary.routes');
const assistantRoutes = require('./app/routes/assistant.routes');
const webhookRoutes = require('./app/routes/webhook.routes');

const sequelize = require('./app/utils/pool');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8090;

// Add detailed logging middleware
app.use((req, res, next) => {
  console.log('Incoming request:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
  });
  next();
});

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/pin', pinRoutes);
app.use('/api/diagram', diagramRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api', assistantRoutes);

sequelize
  .sync({ logging: console.log })
  .then(() => {
    console.log('Database connected successfully.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

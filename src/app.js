const express = require('express');
const bodyParser = require('body-parser');
const { connectDB, sequelize } = require('./config/db');
const routes = require('./routes');
require('dotenv').config();

const app = express();

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/', routes);

// Start Server Logic
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    // 1. Connect to MySQL & Redis
    await connectDB();

    // 2. Sync Database Tables (Create them if they don't exist)
    // "alter: true" updates tables if you change models later
    await sequelize.sync({ alter: true });
    console.log('✅ Database Models Synced');

    // 3. Start Listening
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
};

startServer();
const { Sequelize } = require('sequelize');
const { createClient } = require('redis');
require('dotenv').config();

// 1. Setup MySQL Connection
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false, // Keep console clean
    }
);

// 2. Setup Redis Connection
const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST}:6379`
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// 3. Connect Function
const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL Connected...');
        await redisClient.connect();
        console.log('✅ Redis Connected...');
    } catch (err) {
        console.error('❌ Unable to connect to DB:', err);
        process.exit(1);
    }
};

module.exports = { sequelize, redisClient, connectDB };
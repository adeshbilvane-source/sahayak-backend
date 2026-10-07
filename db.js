const mysql = require('mysql2');
require('dotenv').config();

// .env ke individual variables ko use karne ke liye setup
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed: ', err.message);
    } else {
        console.log('Successfully connected to Sahayak SQL Database!');
        connection.release();
    }
});

module.exports = db.promise();
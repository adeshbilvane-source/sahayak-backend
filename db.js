const mysql = require('mysql2');

// Render par hamesha DATABASE_URL (Connection String) milti hai
// Agar cloud link nahi hoga, toh backup ke liye local XAMPP ka chalega
const db = mysql.createPool(process.env.DATABASE_URL || {
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'sahayak_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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

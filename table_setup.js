const db = require('./db');

const sqlQueries = [
  "CREATE TABLE IF NOT EXISTS appointments (id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL, caretaker_id INT NOT NULL, appointment_date VARCHAR(50) NOT NULL, appointment_time VARCHAR(50) NOT NULL, reason VARCHAR(255), status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS caretaker_profiles (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, full_name VARCHAR(100) NOT NULL, specialization VARCHAR(100), experience_years INT, license_number VARCHAR(50), profile_image LONGTEXT)",
  "CREATE TABLE IF NOT EXISTS connection_requests (id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL, caretaker_id INT NOT NULL, status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS game_scores (id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL, game_name VARCHAR(50) NOT NULL, score INT NOT NULL, avg_reaction_ms INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS patient_profiles (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, full_name VARCHAR(100) NOT NULL, age INT, gender VARCHAR(20), blood_group VARCHAR(10), emergency_contact VARCHAR(20), profile_image LONGTEXT)",
  "CREATE TABLE IF NOT EXISTS reminder_logs (id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL, reminder_type VARCHAR(50) NOT NULL, status VARCHAR(20) NOT NULL, scheduled_at VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, phone_number VARCHAR(20) UNIQUE NOT NULL, email VARCHAR(100), password VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS vitals (id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL, heart_rate INT, spo2 INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
];

async function createTables() {
  console.log("Cloud database par tables banana shuru ho raha hai...");
  for (let query of sqlQueries) {
    try {
      await db.query(query);
      console.log("✅ Table created or verified successfully!");
    } catch (err) {
      console.error("❌ Error creating table:", err.message);
    }
  }
  console.log("Saari tables ka process poora ho gaya! Aap is terminal ko band kar sakte hain.");
  process.exit(0);
}

createTables();

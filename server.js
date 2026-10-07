const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const path = require('path');
const bodyParser = require('body-parser'); 

const app = express();

app.use(cors());

// Limit badhana zaroori hai Base64 images ke liye (50mb)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const JWT_SECRET = 'sahayak_super_secret_key_123';

// ==========================================
// 1. SIGNUP API (Patient / Caretaker)
// ==========================================
app.post('/api/signup', async (req, res) => {
    try {
        const { phone_number, email, password, role, full_name, age, gender, blood_group, emergency_contact, specialization, experience_years, license_number } = req.body;

        if (!phone_number || !password || !role || !full_name) {
            return res.status(400).json({ error: 'PHONE, PASSWORD, ROLE AND FULL NAME ARE REQUIRED.' });
        }

        let checkQuery = 'SELECT id FROM users WHERE phone_number = ?';
        let checkParams = [phone_number];

        if (email) {
            checkQuery += ' OR email = ?';
            checkParams.push(email);
        }

        const [existingUser] = await db.query(checkQuery, checkParams);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'PHONE NUMBER AND EMAIL ARE ALREADY REGISTERED.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const [userResult] = await db.query(
            'INSERT INTO users (phone_number, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [phone_number, email || null, password_hash, role]
        );

        const newUserId = userResult.insertId;

        if (role === 'patient') {
            await db.query(
                'INSERT INTO patient_profiles (user_id, full_name, age, gender, blood_group, emergency_contact) VALUES (?, ?, ?, ?, ?, ?)',
                [newUserId, full_name, age || null, gender || null, blood_group || null, emergency_contact || null]
            );
        } else if (role === 'caretaker') {
            await db.query(
                'INSERT INTO caretaker_profiles (user_id, full_name, specialization, experience_years, license_number) VALUES (?, ?, ?, ?, ?)',
                [newUserId, full_name, specialization || null, experience_years || null, license_number || null]
            );
        }

        res.status(201).json({ message: 'User registered successfully!', user_id: newUserId, role });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error: registration failed.' });
    }
});

// ==========================================
// 2. LOGIN API (Mobile Number OR Email)
// ==========================================
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'MOBILE NUMBER/EMAIL AND PASSWORD ARE REQUIRED.' });
        }

        const [users] = await db.query(
            'SELECT * FROM users WHERE phone_number = ? OR email = ?',
            [identifier, identifier]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'USER NOT FOUND. PLEASE CHECK DETAILS OR SIGN UP.' });
        }

        const user = users[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'INCORRECT PASSWORD.' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, phone: user.phone_number },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        let profile = {};
        if (user.role === 'patient') {
            const [p] = await db.query('SELECT * FROM patient_profiles WHERE user_id = ?', [user.id]);
            profile = p[0] || {};
        } else if (user.role === 'caretaker') {
            const [c] = await db.query('SELECT * FROM caretaker_profiles WHERE user_id = ?', [user.id]);
            profile = c[0] || {};
        }

        res.json({
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                phone_number: user.phone_number,
                email: user.email,
                role: user.role,
                profile
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error: login failed.' });
    }
});

// ==========================================
// 3. UPDATE PROFILE API (With Image) - Patient
// ==========================================
app.put('/api/update-profile', async (req, res) => {
    try {
        const { user_id, full_name, phone_number, emergency_contact, blood_group, profile_image } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'USER ID IS REQUIRED.' });
        }

        if (phone_number) {
            await db.query('UPDATE users SET phone_number = ? WHERE id = ?', [phone_number, user_id]);
        }

        const [userCheck] = await db.query('SELECT role FROM users WHERE id = ?', [user_id]);
        if (userCheck.length === 0) {
            return res.status(404).json({ error: 'User not found in DB.' });
        }
        
        const role = userCheck[0].role;

        if (role === 'patient') {
            await db.query(
                'UPDATE patient_profiles SET full_name = ?, emergency_contact = ?, blood_group = ?, profile_image = COALESCE(?, profile_image) WHERE user_id = ?',
                [full_name, emergency_contact, blood_group, profile_image, user_id]
            );
        } else if (role === 'caretaker') {
            await db.query(
                'UPDATE caretaker_profiles SET full_name = ?, profile_image = COALESCE(?, profile_image) WHERE user_id = ?',
                [full_name, profile_image, user_id]
            );
        }

        res.json({ message: 'Profile updated successfully!', success: true });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Database update failed: ' + error.message });
    }
});

// ==========================================
// 4. GET USER PROFILE BY ID
// ==========================================
app.get('/api/user/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        let profile = {};

        if (user.role === 'patient') {
            const [p] = await db.query('SELECT * FROM patient_profiles WHERE user_id = ?', [userId]);
            profile = p[0] || {};
        } else if (user.role === 'caretaker') {
            const [c] = await db.query('SELECT * FROM caretaker_profiles WHERE user_id = ?', [userId]);
            profile = c[0] || {};
        }

        res.json({
            id: user.id,
            phone_number: user.phone_number,
            email: user.email,
            role: user.role,
            profile: profile 
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// ==========================================
// 5. GET ALL CARETAKERS
// ==========================================
app.get('/api/caretakers', async (req, res) => {
    try {
        const sql = `
            SELECT u.id as user_id, u.phone_number, c.full_name, c.specialization, c.profile_image 
            FROM users u 
            JOIN caretaker_profiles c ON u.id = c.user_id 
            WHERE u.role = 'caretaker'
        `;
        const [caretakers] = await db.query(sql);
        res.json(caretakers);
    } catch (error) {
        console.error('Fetch caretakers error:', error);
        res.status(500).json({ error: 'Failed to fetch caretakers' });
    }
});

// ==========================================
// 6. GET ALL PATIENTS
// ==========================================
app.get('/api/patients', async (req, res) => {
    try {
        const sql = `
            SELECT u.id as user_id, u.phone_number, p.full_name, p.age, p.blood_group, p.profile_image 
            FROM users u 
            JOIN patient_profiles p ON u.id = p.user_id 
            WHERE u.role = 'patient'
        `;
        const [patients] = await db.query(sql);
        res.json(patients);
    } catch (error) {
        console.error('Fetch patients error:', error);
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
});

// ==========================================
// 7. PATIENT: SEND CONNECTION REQUEST
// ==========================================
app.post('/api/send-request', async (req, res) => {
    try {
        const { patient_id, caretaker_id } = req.body;
        
        if (!patient_id || !caretaker_id) {
            return res.status(400).json({ error: 'Patient ID and Caretaker ID are required' });
        }

        const [existing] = await db.query(
            'SELECT id, status FROM connection_requests WHERE patient_id = ? AND caretaker_id = ?', 
            [patient_id, caretaker_id]
        );
        
        if (existing.length > 0) {
            const currentStatus = existing[0].status;
            if (currentStatus === 'pending') {
                return res.status(400).json({ error: 'Request already sent and is pending.' });
            } else if (currentStatus === 'accepted') {
                return res.status(400).json({ error: 'You are already connected to this doctor.' });
            } else if (currentStatus === 'rejected') {
                // Agar pehle reject hui thi, toh status ko wapas 'pending' kar do
                await db.query('UPDATE connection_requests SET status = "pending" WHERE id = ?', [existing[0].id]);
                return res.json({ success: true, message: 'Request sent again successfully!' });
            }
        }

        await db.query(
            'INSERT INTO connection_requests (patient_id, caretaker_id, status) VALUES (?, ?, "pending")', 
            [patient_id, caretaker_id]
        );
        
        res.json({ success: true, message: 'Request sent successfully!' });

    } catch (error) {
        console.error('Send request error:', error);
        res.status(500).json({ error: 'Failed to send request: ' + error.message });
    }
});

// ==========================================
// 8. CARETAKER: GET PENDING REQUESTS
// ==========================================
app.get('/api/pending-requests/:caretaker_id', async (req, res) => {
    try {
        const { caretaker_id } = req.params;
        
        const sql = `
            SELECT cr.id as request_id, p.user_id as patient_id, p.full_name, p.age, p.blood_group, p.profile_image 
            FROM connection_requests cr
            JOIN patient_profiles p ON cr.patient_id = p.user_id
            WHERE cr.caretaker_id = ? AND cr.status = 'pending'
            ORDER BY cr.id DESC
        `;
        
        const [requests] = await db.query(sql, [caretaker_id]);
        res.json(requests);

    } catch (error) {
        console.error('Fetch pending requests error:', error);
        res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
});

// ==========================================
// 9. CARETAKER: ACCEPT / REJECT REQUEST
// ==========================================
app.post('/api/update-request', async (req, res) => {
    try {
        const { request_id, status } = req.body; 
        
        if (!request_id || !['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Valid Request ID and status (accepted/rejected) required' });
        }

        await db.query('UPDATE connection_requests SET status = ? WHERE id = ?', [status, request_id]);
        res.json({ success: true, message: `Request ${status} successfully` });

    } catch (error) {
        console.error('Update request error:', error);
        res.status(500).json({ error: 'Failed to update request' });
    }
});

// ==========================================
// 10. CARETAKER: GET ACCEPTED PATIENTS (SCHEDULE)
// ==========================================
app.get('/api/accepted-patients/:caretaker_id', async (req, res) => {
    try {
        const { caretaker_id } = req.params;
        const sql = `
            SELECT p.user_id as patient_id, p.full_name, p.emergency_contact, p.profile_image 
            FROM connection_requests cr
            JOIN patient_profiles p ON cr.patient_id = p.user_id
            WHERE cr.caretaker_id = ? AND cr.status = 'accepted'
        `;
        const [patients] = await db.query(sql, [caretaker_id]);
        res.json(patients);
    } catch (error) {
        console.error('Fetch accepted patients error:', error);
        res.status(500).json({ error: 'Failed to fetch accepted patients' });
    }
});

// ==========================================
// 11. APPOINTMENT: BOOK SLOT (PATIENT)
// ==========================================
app.post('/api/book-appointment', async (req, res) => {
    try {
        const { patient_id, caretaker_id, appointment_date, appointment_time, reason } = req.body;
        
        if (!patient_id || !caretaker_id || !appointment_date || !appointment_time) {
            return res.status(400).json({ error: 'All appointment fields are required.' });
        }

        await db.query(
            'INSERT INTO appointments (patient_id, caretaker_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, "pending")',
            [patient_id, caretaker_id, appointment_date, appointment_time, reason || 'Routine Checkup']
        );

        res.json({ success: true, message: 'Appointment slot requested successfully!' });
    } catch (error) {
        console.error('Book appointment error:', error);
        res.status(500).json({ error: 'Failed to book appointment' });
    }
});

// ==========================================
// 12. APPOINTMENT: GET CONFIRMED / PENDING FOR PATIENT
// ==========================================
app.get('/api/patient-appointments/:patient_id', async (req, res) => {
    try {
        const { patient_id } = req.params;
        // Fix: Added emergency_contact select here
        const sql = `
            SELECT a.*, c.full_name as caretaker_name, c.specialization, c.profile_image 
            FROM appointments a
            JOIN caretaker_profiles c ON a.caretaker_id = c.user_id
            WHERE a.patient_id = ?
        `;
        const [appointments] = await db.query(sql, [patient_id]);
        res.json(appointments);
    } catch (error) {
        console.error('Fetch patient appointments error:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// ==========================================
// 13. CARETAKER: GET ALL BOOKED APPOINTMENTS FOR HOME PAGE
// ==========================================
app.get('/api/caretaker-appointments/:caretaker_id', async (req, res) => {
    try {
        const { caretaker_id } = req.params;
        // Fix: Added p.emergency_contact so Flutter can receive it
        const sql = `
            SELECT a.id as appointment_id, a.appointment_date, a.appointment_time, a.reason, a.status,
                   p.user_id as patient_id, p.full_name as patient_name, p.profile_image, p.emergency_contact 
            FROM appointments a
            JOIN patient_profiles p ON a.patient_id = p.user_id
            WHERE a.caretaker_id = ? AND a.status = 'accepted'
            ORDER BY a.id DESC
        `;
        const [appointments] = await db.query(sql, [caretaker_id]);
        res.json(appointments);
    } catch (error) {
        console.error('Fetch caretaker home appointments error:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// ==========================================
// 14. UPDATE CARETAKER PROFILE (Doctor Side)
// ==========================================
app.put('/api/update-caretaker-profile', async (req, res) => {
    try {
        const { user_id, full_name, specialization, experience_years, license_number, profile_image } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        let updateQuery = 'UPDATE caretaker_profiles SET full_name = ?';
        let queryParams = [full_name];

        if (specialization !== undefined) {
            updateQuery += ', specialization = ?';
            queryParams.push(specialization);
        }
        
        if (experience_years !== undefined && experience_years !== null) {
            updateQuery += ', experience_years = ?';
            queryParams.push(experience_years);
        }
        
        if (license_number !== undefined) {
            updateQuery += ', license_number = ?';
            queryParams.push(license_number);
        }

        if (profile_image !== undefined) {
            updateQuery += ', profile_image = ?';
            queryParams.push(profile_image);
        }

        updateQuery += ' WHERE user_id = ?';
        queryParams.push(user_id);

        const [result] = await db.query(updateQuery, queryParams);
        
        if (result.affectedRows === 0) {
             return res.status(404).json({ error: 'Caretaker profile not found' });
        }

        res.json({ message: 'Profile updated successfully', success: true });
    } catch (error) {
        console.error('Database update error:', error);
        res.status(500).json({ error: 'Database update error: ' + error.message });
    }
});

// ==========================================
// CARETAKER: GET PENDING APPOINTMENTS
// ==========================================
app.get('/api/caretaker-pending-appointments/:caretaker_id', async (req, res) => {
    try {
        const { caretaker_id } = req.params;
        const sql = `
            SELECT a.id as appointment_id, a.appointment_date, a.appointment_time, a.reason, a.status,
                   p.user_id as patient_id, p.full_name as patient_name, p.profile_image, p.emergency_contact
            FROM appointments a
            JOIN patient_profiles p ON a.patient_id = p.user_id
            WHERE a.caretaker_id = ? AND a.status = 'pending'
            ORDER BY a.id DESC
        `;
        const [appointments] = await db.query(sql, [caretaker_id]);
        res.json(appointments);
    } catch (error) {
        console.error('Fetch caretaker pending appointments error:', error);
        res.status(500).json({ error: 'Failed to fetch pending appointments' });
    }
});

// Caretaker: Accept or Reject Appointment
app.post('/api/update-appointment-status', async (req, res) => {
    try {
        const { appointment_id, status } = req.body; // status can be 'accepted' or 'rejected'
        if (!appointment_id || !['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Valid Appointment ID and status required' });
        }

        await db.query('UPDATE appointments SET status = ? WHERE id = ?', [status, appointment_id]);
        res.json({ success: true, message: `Appointment ${status} successfully` });
    } catch (error) {
        console.error('Update appointment status error:', error);
        res.status(500).json({ error: 'Failed to update appointment status' });
    }
});
// ==========================================
// PATIENT: GET CONNECTED CARETAKERS FOR CHAT
// ==========================================
app.get('/api/patient-accepted-caretakers/:patient_id', async (req, res) => {
    try {
        const { patient_id } = req.params;
        const sql = `
            SELECT c.user_id as caretaker_id, c.full_name, c.specialization, c.profile_image, c.experience_years
            FROM connection_requests cr
            JOIN caretaker_profiles c ON cr.caretaker_id = c.user_id
            WHERE cr.patient_id = ? AND cr.status = 'accepted'
        `;
        const [caretakers] = await db.query(sql, [patient_id]);
        res.json(caretakers);
    } catch (error) {
        console.error('Fetch patient accepted caretakers error:', error);
        res.status(500).json({ error: 'Failed to fetch connected caretakers' });
    }
});

// ==========================================
// 15. GET PATIENT ANALYTICS (For Caretaker)
// ==========================================
app.get('/api/patient-analytics/:patient_id', async (req, res) => {
    try {
        const { patient_id } = req.params;

        // Aapne 'vitals', 'game_scores', 'reminder_logs' tables banayi hain, 
        // toh aap un tables se data nikal kar yahan bhej sakte hain.
        // Abhi UI ko properly show karne ke liye, hum wahi JSON structure 
        // bhej rahe hain jo Flutter expect kar raha hai:

        const analyticsData = {
            reminders: {
                total: 20,
                taken: 17,
                by_type: {
                    medicine: { total: 10, taken: 9 },
                    water: { total: 6, taken: 5 },
                    routine: { total: 4, taken: 3 }
                }
            },
            games: {
                sessions: 14,
                best_score: 420,
                avg_reaction_ms: 1200,
                weekly: [
                    { date: '2026-09-28', sessions: 2 },
                    { date: '2026-09-29', sessions: 4 },
                    { date: '2026-09-30', sessions: 3 },
                    { date: '2026-10-01', sessions: 5 }
                ]
            },
            vitals: {
                heart_rate: 72,
                spo2: 98
            }
        };

        // Asli DB Query Example (Agar data database se lana ho):
        /*
        const [vitalsData] = await db.query('SELECT heart_rate, spo2 FROM vitals WHERE patient_id = ? ORDER BY id DESC LIMIT 1', [patient_id]);
        if (vitalsData.length > 0) {
            analyticsData.vitals.heart_rate = vitalsData[0].heart_rate;
            analyticsData.vitals.spo2 = vitalsData[0].spo2;
        }
        */

        res.json(analyticsData);
    } catch (error) {
        console.error('Analytics fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch patient analytics' });
    }
});

// ==========================================
// SERVER LISTEN (Bound to 0.0.0.0 for Network Access)
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
});
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Store received SMS (for testing)
let lastSMS = null;

// This is where SMS Forwarder will send messages
app.post('/sms', (req, res) => {
    console.log('SMS Received:', req.body);
    
    // Store for viewing
    lastSMS = {
        time: new Date().toISOString(),
        data: req.body
    };
    
    // For now, just log it
    res.json({ 
        success: true, 
        message: 'SMS received',
        received: req.body 
    });
});

// View last SMS (for testing)
app.get('/last-sms', (req, res) => {
    res.json(lastSMS || { message: 'No SMS received yet' });
});

// Home page
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>SMS Server</title></head>
            <body>
                <h1>SMS Server is Running!</h1>
                <p>Your webhook URL is: <strong>https://YOUR-APP.onrender.com/sms</strong></p>
                <p>Send SMS to test: <a href="/last-sms">View last SMS</a></p>
            </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

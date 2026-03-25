
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://invest-foram-platform.firebaseio.com"
});

const db = admin.firestore();

// PesaPal Credentials - YOUR ACTUAL CREDENTIALS
const PESAPAL_CONFIG = {
    consumerKey: "53GYe+1f0iX+ofdy9pRFvxxQ4WSjmKUY",
    consumerSecret: "GYpeMGAyaVDit8PcPlS4YHF2dms=",
    // Using sandbox for testing (change to live when ready)
    baseUrl: "https://sandbox.pesapal.com"
};

// Helper function to generate OAuth signature
function generateOAuthSignature(method, url, params, consumerSecret) {
    const signatureString = method + '&' + encodeURIComponent(url) + '&' + encodeURIComponent(params);
    const signingKey = consumerSecret + '&';
    return crypto.createHmac('sha1', signingKey).update(signatureString).digest('base64');
}

// Step 1: Get PesaPal Token
async function getPesaPalToken() {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = crypto.randomBytes(16).toString('hex');
        
        const oauthParams = {
            oauth_consumer_key: PESAPAL_CONFIG.consumerKey,
            oauth_nonce: nonce,
            oauth_signature_method: "HMAC-SHA1",
            oauth_timestamp: timestamp,
            oauth_version: "1.0"
        };
        
        const sortedParams = Object.keys(oauthParams)
            .sort()
            .map(key => `${key}=${oauthParams[key]}`)
            .join('&');
        
        const signature = generateOAuthSignature(
            'POST',
            `${PESAPAL_CONFIG.baseUrl}/api/PostPesapalDirectOrderV4`,
            sortedParams,
            PESAPAL_CONFIG.consumerSecret
        );
        
        oauthParams.oauth_signature = signature;
        
        const authHeader = 'OAuth ' + Object.keys(oauthParams)
            .map(key => `${key}="${oauthParams[key]}"`)
            .join(',');
        
        const response = await axios.post(
            `${PESAPAL_CONFIG.baseUrl}/api/PostPesapalDirectOrderV4`,
            {},
            { headers: { 'Authorization': authHeader } }
        );
        
        return response.data;
    } catch (error) {
        console.error('Get token error:', error.response?.data || error.message);
        throw error;
    }
}

// Initiate Payment
app.post('/api/initiate-payment', async (req, res) => {
    try {
        const { amount, phone, email, userId, fullName } = req.body;
        
        if (!amount || amount < 300000) {
            return res.status(400).json({ error: 'Minimum amount is UGX 300,000' });
        }
        
        const orderId = `FORAM${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        // Save pending transaction
        await db.collection('pending_transactions').doc(orderId).set({
            orderId: orderId,
            userId: userId,
            amount: amount,
            phone: phone,
            email: email,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = crypto.randomBytes(16).toString('hex');
        
        const paymentParams = {
            oauth_callback: `http://localhost:3000/api/callback`,
            pesapal_merchant_reference: orderId,
            pesapal_amount: amount.toString(),
            pesapal_currency: "UGX",
            pesapal_description: `Investment deposit - ${orderId}`,
            pesapal_type: "MERCHANT",
            pesapal_email: email,
            pesapal_phone_number: phone,
            pesapal_first_name: fullName?.split(' ')[0] || "Investor",
            pesapal_last_name: fullName?.split(' ')[1] || "User"
        };
        
        const oauthParams = {
            oauth_consumer_key: PESAPAL_CONFIG.consumerKey,
            oauth_nonce: nonce,
            oauth_signature_method: "HMAC-SHA1",
            oauth_timestamp: timestamp,
            oauth_version: "1.0"
        };
        
        const allParams = { ...paymentParams, ...oauthParams };
        const sortedParams = Object.keys(allParams)
            .sort()
            .map(key => `${key}=${allParams[key]}`)
            .join('&');
        
        const signature = generateOAuthSignature(
            'POST',
            `${PESAPAL_CONFIG.baseUrl}/api/PostPesapalDirectOrderV4`,
            sortedParams,
            PESAPAL_CONFIG.consumerSecret
        );
        
        oauthParams.oauth_signature = signature;
        
        const authHeader = 'OAuth ' + Object.keys(oauthParams)
            .map(key => `${key}="${oauthParams[key]}"`)
            .join(',');
        
        const response = await axios.post(
            `${PESAPAL_CONFIG.baseUrl}/api/PostPesapalDirectOrderV4`,
            paymentParams,
            { headers: { 'Authorization': authHeader } }
        );
        
        res.json({
            success: true,
            redirectUrl: response.data.redirect_url,
            orderId: orderId
        });
        
    } catch (error) {
        console.error('Initiate error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to initiate payment' });
    }
});

// Payment Callback
app.get('/api/callback', async (req, res) => {
    try {
        const { pesapal_transaction_tracking_id, pesapal_merchant_reference } = req.query;
        
        // Verify payment
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = crypto.randomBytes(16).toString('hex');
        
        const oauthParams = {
            oauth_consumer_key: PESAPAL_CONFIG.consumerKey,
            oauth_nonce: nonce,
            oauth_signature_method: "HMAC-SHA1",
            oauth_timestamp: timestamp,
            oauth_version: "1.0"
        };
        
        const sortedParams = Object.keys(oauthParams)
            .sort()
            .map(key => `${key}=${oauthParams[key]}`)
            .join('&');
        
        const signature = generateOAuthSignature(
            'GET',
            `${PESAPAL_CONFIG.baseUrl}/api/QueryPaymentDetails`,
            sortedParams,
            PESAPAL_CONFIG.consumerSecret
        );
        
        oauthParams.oauth_signature = signature;
        
        const authHeader = 'OAuth ' + Object.keys(oauthParams)
            .map(key => `${key}="${oauthParams[key]}"`)
            .join(',');
        
        const statusResponse = await axios.get(
            `${PESAPAL_CONFIG.baseUrl}/api/QueryPaymentDetails?pesapal_transaction_tracking_id=${pesapal_transaction_tracking_id}`,
            { headers: { 'Authorization': authHeader } }
        );
        
        if (statusResponse.data.pesapal_status === 'COMPLETED') {
            const pendingDoc = await db.collection('pending_transactions').doc(pesapal_merchant_reference).get();
            
            if (pendingDoc.exists && pendingDoc.data().status === 'pending') {
                const transaction = pendingDoc.data();
                
                // Update user balance
                const userRef = db.collection('users').doc(transaction.userId);
                const userDoc = await userRef.get();
                const currentBalance = userDoc.data()?.totalBalance || 0;
                await userRef.update({
                    totalBalance: currentBalance + transaction.amount
                });
                
                // Record transaction
                await db.collection('users').doc(transaction.userId).collection('transactions').add({
                    type: 'deposit',
                    amount: transaction.amount,
                    method: 'PesaPal',
                    reference: pesapal_merchant_reference,
                    pesapalId: pesapal_transaction_tracking_id,
                    status: 'completed',
                    date: admin.firestore.FieldValue.serverTimestamp()
                });
                
                // Update pending status
                await db.collection('pending_transactions').doc(pesapal_merchant_reference).update({
                    status: 'completed',
                    pesapalId: pesapal_transaction_tracking_id
                });
                
                res.send(`
                    <html>
                        <head><title>Payment Successful</title></head>
                        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                            <h1>✅ Payment Successful!</h1>
                            <p>Amount: UGX ${transaction.amount.toLocaleString()}</p>
                            <p>Your balance has been updated.</p>
                            <a href="dashboard.html">Return to Dashboard</a>
                            <script>setTimeout(() => { window.location.href = 'dashboard.html'; }, 3000);</script>
                        </body>
                    </html>
                `);
            }
        } else {
            res.send(`
                <html>
                    <head><title>Payment Failed</title></head>
                    <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                        <h1>❌ Payment Failed</h1>
                        <p>Please try again or contact support.</p>
                        <a href="dashboard.html">Return to Dashboard</a>
                    </body>
                </html>
            `);
        }
    } catch (error) {
        console.error('Callback error:', error);
        res.send('Payment verification failed');
    }
});

// Check payment status
app.get('/api/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const doc = await db.collection('pending_transactions').doc(orderId).get();
        if (doc.exists) {
            res.json({ status: doc.data().status });
        } else {
            res.json({ status: 'not_found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`PesaPal Mode: Sandbox`);
});

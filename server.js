const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const CONSUMER_KEY = "YOUR_KEY";
const CONSUMER_SECRET = "YOUR_SECRET";

let token = "";

// 🔑 Get token
async function getToken() {
  const res = await axios.post(
    "https://pay.pesapal.com/v3/api/Auth/RequestToken",
    {
      consumer_key: CONSUMER_KEY,
      consumer_secret: CONSUMER_SECRET,
    }
  );

  token = res.data.token;
}

// 💳 Create payment
app.get("/pay", async (req, res) => {
  await getToken();

  const response = await axios.post(
    "https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest",
    {
      id: "ORDER_" + Date.now(),
      currency: "UGX",
      amount: 1000,
      description: "Test Payment",
      callback_url: "https://your-backend-url.onrender.com/callback",
      notification_id: "YOUR_IPN_ID",
      billing_address: {
        email_address: "test@gmail.com",
        phone_number: "2567XXXXXXXX",
        country_code: "UG",
        first_name: "Test",
        last_name: "User",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  res.json({ url: response.data.redirect_url });
});

// 🔔 IPN (VERY IMPORTANT)
app.post("/ipn", (req, res) => {
  console.log("IPN RECEIVED:", req.body);

  // Here you update user balance/database
  res.sendStatus(200);
});

// 🔁 Callback
app.get("/callback", (req, res) => {
  console.log("Callback:", req.query);
  res.send("Payment processed");
});

app.listen(3000, () => console.log("Server running"));

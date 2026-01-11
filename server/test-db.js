require('dotenv').config();
const mongoose = require('mongoose');

console.log("Testing MongoDB Connection...");
console.log("URI provided:", process.env.MONGODB_URI ? "Yes (Hidden)" : "No (Missing)");

if (!process.env.MONGODB_URI) {
    console.error("ERROR: MONGODB_URI is missing from .env file");
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("SUCCESS: Connected to MongoDB successfully!");
        console.log("Database Name:", mongoose.connection.name);
        console.log("Host:", mongoose.connection.host);
        mongoose.connection.close();
        process.exit(0);
    })
    .catch((err) => {
        console.error("FAILURE: Could not connect to MongoDB.");
        console.error("Error Name:", err.name);
        console.error("Error Message:", err.message);
        if (err.cause) console.error("Cause:", err.cause);
        process.exit(1);
    });

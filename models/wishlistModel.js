const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    items: [{
        productId: {
            type: Number,
            required: true,
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        // Optional: Store product info at time of adding to wishlist
        productSnapshot: {
            name: String,
            price: Number,
            image: String,
            category: String
        }
    }],
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Wishlist", wishlistSchema);


// Add these to your index.js file after your existing schemas and before app.listen()

// Install required packages first:
// npm install nodemailer
// npm install dotenv (if not already installed)

// const nodemailer = require('nodemailer');
// require('dotenv').config();

// Contact Form Schema
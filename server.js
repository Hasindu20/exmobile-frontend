const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Multer Setup (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 3. MongoDB Connection Caching for Vercel Serverless
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://hasindukavinda200801_db_user:7mFKFhPMt1908sEd@cluster0.upgjxcq.mongodb.net/exmobile?retryWrites=true&w=majority&appName=Cluster0";

let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;
    try {
        const db = await mongoose.connect(MONGO_URI);
        isConnected = db.connections[0].readyState === 1;
        console.log('MongoDB Cloud Connected Successfully!');
    } catch (err) {
        console.error('DB Connection Error:', err);
    }
};

// Middleware to ensure DB is connected before handling requests
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// 4. Listing Model / Schema
const AdSchema = new mongoose.Schema({
    brand: String,
    model: String,
    storage: String,
    batteryHealth: Number,
    condition: String,
    price: Number,
    description: String,
    sellerName: String,
    location: String,
    whatsapp: String,
    images: [String],
    isVerified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Ad = mongoose.models.Ad || mongoose.model('Ad', AdSchema);

// Root Route (Health Check)
app.get('/', (req, res) => {
    res.send('EXmobile Backend API is Running Live!');
});

// 5. API Route: Post New Ad
app.post('/api/ads', upload.array('photos', 4), async (req, res) => {
    try {
        const imageUrls = [];

        // Upload images to Cloudinary
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { folder: 'exmobile_ads' },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(file.buffer);
                });
                imageUrls.push(result.secure_url);
            }
        }

        // Create new Ad document
        const newAd = new Ad({
            brand: req.body.brand,
            model: req.body.model,
            storage: req.body.storage,
            batteryHealth: req.body.batteryHealth,
            condition: req.body.condition,
            price: req.body.price,
            description: req.body.description,
            sellerName: req.body.sellerName,
            location: req.body.location,
            whatsapp: req.body.whatsapp,
            images: imageUrls
        });

        await newAd.save();
        res.status(201).json({ success: true, message: 'Ad Published Successfully!', ad: newAd });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error during Ad creation' });
    }
});

// 6. API Route: Get All Ads
app.get('/api/ads', async (req, res) => {
    try {
        const ads = await Ad.find().sort({ createdAt: -1 });
        res.status(200).json(ads);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching ads' });
    }
});

// 7. API Route: Get Single Ad Details
app.get('/api/ads/:id', async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id);
        if (!ad) {
            return res.status(404).json({ message: 'Ad not found' });
        }
        res.json(ad);
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching ad details' });
    }
});

// Export App for Vercel Serverless Deployment
module.exports = app;

// Local Environment එකේදී Run වීමට පමණක් (Vercel හිදී මෙය Skip වේ)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`EXmobile Server running on port ${PORT}`);
    });
}
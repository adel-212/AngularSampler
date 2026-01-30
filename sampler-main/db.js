import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sampler';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('⚠️  Falling back to filesystem-based storage');
    });

export default mongoose.connection;

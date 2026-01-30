import mongoose from 'mongoose';

const soundSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true }
}, { _id: false });

const presetSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: { type: String, required: true },
    sounds: [soundSchema]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for count
presetSchema.virtual('count').get(function () {
    return this.sounds?.length || 0;
});

export default mongoose.model('Preset', presetSchema);

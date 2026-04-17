import mongoose from 'mongoose';

const SignProgressSchema = new mongoose.Schema({
  letter:       { type: String, required: true },
  attempts:     { type: Number, default: 0 },
  bestScore:    { type: Number, default: 0 },
  mastered:     { type: Boolean, default: false },  // score >= 85
  lastPractice: { type: Date, default: Date.now }
});

const UserProgressSchema = new mongoose.Schema({
  userId:       { type: String, required: true, unique: true },
  signs:        [SignProgressSchema],
  streak:       { type: Number, default: 0 },        // días consecutivos
  lastActive:   { type: Date, default: Date.now },
  voiceId:      { type: String, default: '21m00Tcm4TlvDq8ikWAM' }
}, { timestamps: true });

// Evitar re-compilar el modelo si ya existe (hot reload en desarrollo)
const UserProgress = mongoose.models.UserProgress || mongoose.model('UserProgress', UserProgressSchema);

export default UserProgress;

import mongoose from 'mongoose';

const VibeVocalConfigSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  voiceId: { 
    type: String, 
    required: true, 
    default: '21m00Tcm4TlvDq8ikWAM' // Voz de ElevenLabs por defecto
  },
  stability: { 
    type: Number, 
    default: 0.5 
  },
  similarityBoost: { 
    type: Number, 
    default: 0.75 
  }
});

const VibeVocalConfig = mongoose.models.VibeVocalConfig || mongoose.model('VibeVocalConfig', VibeVocalConfigSchema);

export default VibeVocalConfig;

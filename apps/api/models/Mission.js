import mongoose from 'mongoose'

const MissionSchema = new mongoose.Schema(
  {
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'LearningModule',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: null,
    },
    xpReward: {
      type: Number,
      default: 10,
      min: 0,
    },
    displayOrder: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
    collection: 'missions',
  }
)

MissionSchema.index({ moduleId: 1, displayOrder: 1 })

const Mission = mongoose.models.Mission || mongoose.model('Mission', MissionSchema)

export default Mission

import mongoose from 'mongoose'

const LearningModuleSchema = new mongoose.Schema(
  {
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
    displayOrder: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
    collection: 'modules',
  }
)

const LearningModule =
  mongoose.models.LearningModule ||
  mongoose.model('LearningModule', LearningModuleSchema)

export default LearningModule

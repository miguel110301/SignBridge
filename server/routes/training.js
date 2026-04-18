import express from 'express'
import mongoose from 'mongoose'

const router = express.Router()

async function ensureConnection() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no definida')
  }

  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(process.env.MONGODB_URI)
}

const TrainingSampleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['static', 'sequence'],
      required: true,
    },
    vector: {
      type: [Number],
      default: undefined,
    },
    frames: {
      type: [mongoose.Schema.Types.Mixed],
      default: undefined,
    },
    variantKey: {
      type: String,
      default: null,
    },
    variantLabel: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true, minimize: false }
)

const TrainingLabelSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    samples: {
      type: [TrainingSampleSchema],
      default: [],
    },
  },
  { timestamps: true }
)

const TrainingLabelModel =
  mongoose.models.TrainingLabel ||
  mongoose.model('TrainingLabel', TrainingLabelSchema)

function normalizeLabel(rawLabel) {
  const value = String(rawLabel || '').trim()
  if (!value) return null
  return value.length === 1 ? value.toUpperCase() : value.toLowerCase()
}

function serializeSample(sample) {
  return {
    id: sample._id.toString(),
    type: sample.type,
    vector: sample.vector,
    frames: sample.frames,
    variantKey: sample.variantKey,
    variantLabel: sample.variantLabel,
    metadata: sample.metadata ?? {},
    createdAt: sample.createdAt,
  }
}

function serializeDataset(documents) {
  return documents.reduce((accumulator, document) => {
    accumulator[document.label] = document.samples.map(serializeSample)
    return accumulator
  }, {})
}

router.get('/', async (_, res) => {
  try {
    await ensureConnection()
    const documents = await TrainingLabelModel.find().sort({ label: 1 })
    res.json(serializeDataset(documents))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:label', async (req, res) => {
  try {
    await ensureConnection()
    const label = normalizeLabel(req.params.label)
    if (!label) {
      return res.status(400).json({ error: 'label invalida' })
    }

    const document = await TrainingLabelModel.findOne({ label })
    res.json({
      label,
      samples: document ? document.samples.map(serializeSample) : [],
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/:label', async (req, res) => {
  try {
    await ensureConnection()
    const label = normalizeLabel(req.params.label)
    const {
      type = 'static',
      vector,
      frames,
      variantKey = null,
      variantLabel = null,
      metadata = {},
    } = req.body ?? {}

    if (!label) {
      return res.status(400).json({ error: 'label invalida' })
    }

    if (type === 'static' && (!Array.isArray(vector) || vector.length === 0)) {
      return res.status(400).json({ error: 'vector requerido para muestras estaticas' })
    }

    if (type === 'sequence' && (!Array.isArray(frames) || frames.length === 0)) {
      return res.status(400).json({ error: 'frames requeridos para secuencias' })
    }

    const document =
      (await TrainingLabelModel.findOne({ label })) ||
      new TrainingLabelModel({ label, samples: [] })

    document.samples.push({
      type,
      vector: type === 'static' ? vector : undefined,
      frames: type === 'sequence' ? frames : undefined,
      variantKey,
      variantLabel,
      metadata,
    })

    await document.save()

    const savedSample = document.samples[document.samples.length - 1]
    res.status(201).json({
      success: true,
      label,
      sample: serializeSample(savedSample),
      total: document.samples.length,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/', async (_, res) => {
  try {
    await ensureConnection()
    await TrainingLabelModel.deleteMany({})
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:label', async (req, res) => {
  try {
    await ensureConnection()
    const label = normalizeLabel(req.params.label)
    if (!label) {
      return res.status(400).json({ error: 'label invalida' })
    }

    await TrainingLabelModel.deleteOne({ label })
    res.json({ success: true, label })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:label/:sampleId', async (req, res) => {
  try {
    await ensureConnection()
    const label = normalizeLabel(req.params.label)
    const { sampleId } = req.params

    if (!label || !sampleId) {
      return res.status(400).json({ error: 'label o sampleId invalidos' })
    }

    const document = await TrainingLabelModel.findOne({ label })
    if (!document) {
      return res.status(404).json({ error: 'label no encontrada' })
    }

    const sample = document.samples.id(sampleId)
    if (!sample) {
      return res.status(404).json({ error: 'muestra no encontrada' })
    }

    sample.deleteOne()

    if (document.samples.length === 0) {
      await TrainingLabelModel.deleteOne({ label })
    } else {
      await document.save()
    }

    res.json({ success: true, label, sampleId })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router

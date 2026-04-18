import express from 'express'
import mongoose from 'mongoose'
import { verifyAuthToken } from '../lib/auth.js'
import User from '../models/User.js'
import LearningModule from '../models/LearningModule.js'
import Mission from '../models/Mission.js'
import { resolveUserMissionModel } from '../models/UserMission.js'

const router = express.Router()
const XP_PER_LEVEL = 100

async function ensureConnection() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no definida')
  }

  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(process.env.MONGODB_URI)
}

function readBearerToken(req) {
  const authorization = req.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) return null
  return authorization.slice('Bearer '.length).trim()
}

function readAuthenticatedUserId(req) {
  const token = readBearerToken(req)
  if (!token) return null

  try {
    const payload = verifyAuthToken(token)
    return String(payload.sub || '')
  } catch {
    return null
  }
}

function calculateLevel(totalXp) {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1
}

function getXpForNextLevel(totalXp) {
  const progressInCurrentLevel = totalXp % XP_PER_LEVEL
  return XP_PER_LEVEL - progressInCurrentLevel
}

function serializeMission(mission, completedMissionIds) {
  const missionId = String(mission._id)

  return {
    id: missionId,
    title: mission.title,
    description: mission.description,
    xpReward: mission.xpReward,
    displayOrder: mission.displayOrder,
    completed: completedMissionIds.has(missionId),
  }
}

function buildUserMissionFilter(userObjectId, userIdString) {
  return {
    $or: [{ userId: userObjectId }, { userId: userIdString }],
  }
}

function buildMissionFilter(missionObjectId, missionIdString) {
  return {
    $or: [{ missionId: missionObjectId }, { missionId: missionIdString }],
  }
}

async function getModuleProgressStats(
  userObjectId,
  userIdString,
  moduleId,
  UserMissionModel
) {
  const moduleMissions = await Mission.find({ moduleId }).select('_id').lean()
  const moduleMissionIds = moduleMissions.map((entry) => entry._id)
  const moduleMissionIdStrings = moduleMissionIds.map((entry) => String(entry))
  const totalMissions = moduleMissionIds.length

  if (totalMissions === 0) {
    return {
      totalMissions: 0,
      completedMissions: 0,
      completionRate: 0,
    }
  }

  const completedMissions = await UserMissionModel.countDocuments({
    $and: [
      buildUserMissionFilter(userObjectId, userIdString),
      {
        $or: [
          { missionId: { $in: moduleMissionIds } },
          { missionId: { $in: moduleMissionIdStrings } },
        ],
      },
    ],
  })

  return {
    totalMissions,
    completedMissions,
    completionRate: Math.round((completedMissions / totalMissions) * 100),
  }
}

router.get('/modules', async (req, res) => {
  try {
    await ensureConnection()

    const authUserId = readAuthenticatedUserId(req)
    if (!authUserId) {
      return res.status(401).json({ error: 'Token inválido o faltante.' })
    }

    if (!mongoose.isValidObjectId(authUserId)) {
      return res.status(400).json({ error: 'Usuario inválido.' })
    }

    const userObjectId = new mongoose.Types.ObjectId(authUserId)
    const UserMissionModel = await resolveUserMissionModel()

    const [modules, missions, completedEntries] = await Promise.all([
      LearningModule.find().sort({ displayOrder: 1 }).lean(),
      Mission.find().sort({ moduleId: 1, displayOrder: 1 }).lean(),
      UserMissionModel.find(buildUserMissionFilter(userObjectId, authUserId))
        .select('missionId -_id')
        .lean(),
    ])

    const completedMissionIds = new Set(
      completedEntries.map((entry) => String(entry.missionId))
    )

    const missionsByModuleId = new Map()
    for (const mission of missions) {
      const moduleKey = String(mission.moduleId)
      const bucket = missionsByModuleId.get(moduleKey) || []
      bucket.push(serializeMission(mission, completedMissionIds))
      missionsByModuleId.set(moduleKey, bucket)
    }

    const moduleViews = modules.map((moduleEntry) => {
      const moduleMissions = missionsByModuleId.get(String(moduleEntry._id)) || []
      const totalMissions = moduleMissions.length
      const completedMissions = moduleMissions.filter((entry) => entry.completed).length

      return {
        id: String(moduleEntry._id),
        title: moduleEntry.title,
        description: moduleEntry.description,
        displayOrder: moduleEntry.displayOrder,
        totalMissions,
        completedMissions,
        completionRate:
          totalMissions > 0
            ? Math.round((completedMissions / totalMissions) * 100)
            : 0,
        missions: moduleMissions,
      }
    })

    const totalMissions = moduleViews.reduce((sum, moduleEntry) => {
      return sum + moduleEntry.totalMissions
    }, 0)

    const completedMissions = moduleViews.reduce((sum, moduleEntry) => {
      return sum + moduleEntry.completedMissions
    }, 0)

    res.json({
      modules: moduleViews,
      summary: {
        totalModules: moduleViews.length,
        totalMissions,
        completedMissions,
        completionRate:
          totalMissions > 0
            ? Math.round((completedMissions / totalMissions) * 100)
            : 0,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/missions/:missionId/complete', async (req, res) => {
  try {
    await ensureConnection()

    const authUserId = readAuthenticatedUserId(req)
    if (!authUserId) {
      return res.status(401).json({ error: 'Token inválido o faltante.' })
    }

    if (!mongoose.isValidObjectId(authUserId)) {
      return res.status(400).json({ error: 'Usuario inválido.' })
    }

    const { missionId } = req.params
    if (!mongoose.isValidObjectId(missionId)) {
      return res.status(400).json({ error: 'missionId inválido.' })
    }

    const userObjectId = new mongoose.Types.ObjectId(authUserId)
    const missionObjectId = new mongoose.Types.ObjectId(missionId)
    const UserMissionModel = await resolveUserMissionModel()

    const [user, mission] = await Promise.all([
      User.findById(userObjectId),
      Mission.findById(missionObjectId),
    ])

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }

    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' })
    }

    const existingCompletion = await UserMissionModel.findOne({
      $and: [
        buildUserMissionFilter(userObjectId, authUserId),
        buildMissionFilter(missionObjectId, missionId),
      ],
    }).lean()

    if (existingCompletion) {
      const moduleProgress = await getModuleProgressStats(
        userObjectId,
        authUserId,
        mission.moduleId,
        UserMissionModel
      )

      return res.json({
        missionId,
        moduleId: String(mission.moduleId),
        alreadyCompleted: true,
        gainedXp: 0,
        totalXp: user.xp || 0,
        level: user.level || 1,
        xpForNextLevel: getXpForNextLevel(user.xp || 0),
        moduleProgress,
      })
    }

    const gainedXp = Number(mission.xpReward || 0)

    await UserMissionModel.create({
      userId: userObjectId,
      missionId: missionObjectId,
      xpGranted: gainedXp,
      completedAt: new Date(),
      createdAt: new Date(),
    })

    const nextXp = Number(user.xp || 0) + gainedXp
    user.xp = nextXp
    user.level = calculateLevel(nextXp)
    await user.save()

    const moduleProgress = await getModuleProgressStats(
      userObjectId,
      authUserId,
      mission.moduleId,
      UserMissionModel
    )

    res.status(201).json({
      missionId,
      moduleId: String(mission.moduleId),
      alreadyCompleted: false,
      gainedXp,
      totalXp: user.xp,
      level: user.level,
      xpForNextLevel: getXpForNextLevel(user.xp),
      moduleProgress,
    })
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: 'La misión ya estaba completada para este usuario.',
      })
    }

    res.status(500).json({ error: error.message })
  }
})

export default router

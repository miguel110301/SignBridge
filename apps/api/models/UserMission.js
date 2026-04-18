import mongoose from 'mongoose'

const UserMissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'User',
    },
    missionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'Mission',
    },
    xpGranted: {
      type: Number,
      required: true,
      min: 0,
    },
    completedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
)

UserMissionSchema.index({ userId: 1, missionId: 1 }, { unique: true })
UserMissionSchema.index({ userId: 1, completedAt: -1 })
UserMissionSchema.index({ missionId: 1 })

export const UserMission =
  mongoose.models.UserMission ||
  mongoose.model('UserMission', UserMissionSchema, 'user_missions')

export const UsersMission =
  mongoose.models.UsersMission ||
  mongoose.model('UsersMission', UserMissionSchema, 'users_missions')

let cachedModel = null

export async function resolveUserMissionModel() {
  if (cachedModel) return cachedModel

  const db = mongoose.connection?.db
  if (!db) {
    cachedModel = UserMission
    return cachedModel
  }

  const collections = await db.listCollections({}, { nameOnly: true }).toArray()
  const collectionNames = new Set(collections.map((entry) => entry.name))

  if (collectionNames.has('user_missions')) {
    cachedModel = UserMission
    return cachedModel
  }

  if (collectionNames.has('users_missions')) {
    cachedModel = UsersMission
    return cachedModel
  }

  cachedModel = UserMission
  return cachedModel
}

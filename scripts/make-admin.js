/**
 * Uso: node scripts/make-admin.js tu@email.com
 * Convierte un usuario existente en admin.
 */
import dotenv from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const email = process.argv[2]
if (!email) {
  console.error('Uso: node scripts/make-admin.js tu@email.com')
  process.exit(1)
}

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  passwordHash: String,
  role: { type: String, default: 'user' },
  xp: Number,
  level: Number,
}, { timestamps: true })

await mongoose.connect(process.env.MONGODB_URI)

const User = mongoose.models.User || mongoose.model('User', UserSchema)
const user = await User.findOneAndUpdate(
  { email: email.toLowerCase().trim() },
  { $set: { role: 'admin' } },
  { new: true }
)

if (!user) {
  console.error(`❌ No se encontró usuario con email: ${email}`)
} else {
  console.log(`✅ ${user.name} (${user.email}) ahora es admin.`)
}

await mongoose.disconnect()

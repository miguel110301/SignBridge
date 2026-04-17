import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  console.log('--- Testing MongoDB Connection ---');
  console.log('URI:', uri ? uri.replace(/:([^@]+)@/, ':****@') : 'NOT FOUND');

  if (!uri || uri.includes('TuContraseñaReal')) {
    console.error('\n❌ ERROR: La URI todavía tiene el marcador "TuContraseñaReal".');
    console.error('Edita el archivo .env y pon la contraseña correcta.');
    process.exit(1);
  }

  try {
    console.log('Intentando conectar a MongoDB Atlas...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    
    console.log('\n✅ ¡ÉXITO! Conexión establecida correctamente.');
    console.log('Base de datos activa:', mongoose.connection.name);
    
    // Intentar una operación real: listar colecciones
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Colecciones encontradas:', collections.map(c => c.name));
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR DE CONEXIÓN:');
    if (err.message.includes('Authentication failed')) {
      console.error('Error de autenticación: El usuario o la contraseña son incorrectos.');
    } else if (err.message.includes('querySrv ETIMEOUT')) {
      console.error('Error de red: No se pudo encontrar el cluster. Revisa tu conexión a internet.');
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
}

testConnection();

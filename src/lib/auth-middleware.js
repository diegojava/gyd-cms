// src/lib/auth-middleware.js
// Middleware para autorizar acceso a rutas protegidas
import { adminAuth } from './firebase-admin-config';

// *** IMPORTANTE: Obtén tu UID de administrador DESPUÉS de hacer login por primera vez (ver Paso 6) ***
const ADMIN_UID = "KPl7IQzMeIVVTlbEPeU9ytFagJg1"; // EJEMPLO: "abcdef1234567890abcdef1234567890"

export async function authorizeAdmin(request) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, status: 401, message: 'No autorizado: Token no proporcionado.' };
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.uid === ADMIN_UID) {
      return { authorized: true, uid: decodedToken.uid };
    } else {
      console.warn(`Intento de acceso no autorizado por UID: ${decodedToken.uid}`);
      return { authorized: false, status: 403, message: 'Prohibido: No tienes permisos para esta operación.' };
    }
  } catch (error) {
    console.error('Error al verificar el token de ID:', error.message);
    return { authorized: false, status: 401, message: 'No autorizado: Token inválido o expirado.' };
  }
}
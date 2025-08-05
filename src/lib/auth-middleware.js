// src/lib/auth-middleware.js
import { getFirebaseAdmin } from './firebase-admin-config';

const ADMIN_UID = "3qdvuqFaIFTWkmiIhLsQ5Aw2VE43";

export async function authorizeAdmin(request) {
  // Obtenemos la instancia de adminAuth llamando a la función
  const { adminAuth } = getFirebaseAdmin();

  // Si la inicialización falló, adminAuth será null
  if (!adminAuth) {
    console.error("Auth middleware: Firebase Admin Auth no está inicializado.");
    return { authorized: false, status: 500, message: 'Error de configuración del servidor.' };
  }

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
      return { authorized: false, status: 403, message: 'Prohibido: No tienes permisos.' };
    }
  } catch (error) {
    return { authorized: false, status: 401, message: 'No autorizado: Token inválido.' };
  }
}
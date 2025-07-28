// node-test.js
console.log("Intentando cargar firebase-admin...");
import * as adminModule from 'firebase-admin'; // Renombramos a 'adminModule' para claridad

// --- NUEVOS CONSOLE.LOGS DE DIAGNÓSTICO (mantener para verificar) ---
console.log('--- Diagnóstico del objeto "adminModule" ---');
console.log('Tipo de "adminModule" object (después de import):', typeof adminModule);
console.log('¿"adminModule" es null o undefined?', adminModule === null || typeof adminModule === 'undefined');
console.log('Claves de "adminModule" object:', Object.keys(adminModule || {}));
console.log('Valor directo de "adminModule":', adminModule);
console.log('-----------------------------------');

// *** CORRECCIÓN CLAVE: Acceder al objeto real del SDK ***
const admin = adminModule.default; // <-- ¡ESTO ES LO IMPORTANTE!

try {
  console.log('Firebase Admin SDK cargado exitosamente (inicio del try-catch).');
  // Ahora, todas las referencias a 'admin' dentro de este bloque son al objeto real del SDK
  console.log('Tipo de admin.credential:', typeof admin.credential);
  if (admin.credential && typeof admin.credential.cert === 'function') {
    console.log('admin.credential.cert está disponible y es una función.');
  } else {
    console.log('admin.credential.cert NO está disponible como se esperaba.');
    console.log('Contenido de admin.credential:', admin.credential);
  }
} catch (e) {
  console.error('Error al cargar firebase-admin (dentro del try-catch):', e);
  console.error('Stack:', e.stack);
}
console.log("Prueba de carga finalizada.");
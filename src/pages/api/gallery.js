// src/pages/api/gallery.js
import { getFirebaseAdmin } from "../../lib/firebase-admin-config.js";
import { authorizeAdmin } from "../../lib/auth-middleware.js";
import { Buffer } from "node:buffer";

// --- GET: Obtener todas las imágenes del bucket ---
export async function GET({ request }) {
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status });
  }

  try {
    const { adminStorage } = getFirebaseAdmin();
    if (!adminStorage) throw new Error("Firebase Storage no está inicializado.");

    const bucket = adminStorage.bucket();
    // Obtenemos todos los archivos. En un proyecto muy grande, se usaría paginación.
    const [files] = await bucket.getFiles();

    // Filtramos para quedarnos solo con imágenes y obtenemos su URL pública
    const imageUrls = files
      .filter(file => file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i))
      .map(file => ({
        name: file.name,
        url: file.publicUrl(),
      }));

    return new Response(JSON.stringify(imageUrls), { status: 200 });
  } catch (error) {
    console.error("Error al obtener archivos de la galería:", error);
    return new Response(JSON.stringify({ error: "No se pudieron obtener los archivos." }), { status: 500 });
  }
}

// --- POST: Subir una nueva imagen a la galería ---
export async function POST({ request }) {
    const authResult = await authorizeAdmin(request);
    if (!authResult.authorized) {
        return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status });
    }

    try {
        const { adminStorage } = getFirebaseAdmin();
        if (!adminStorage) throw new Error("Firebase Storage no está inicializado.");
        
        const formData = await request.formData();
        const imageFile = formData.get("imageFile");

        if (!imageFile || !(imageFile instanceof File) || imageFile.size === 0) {
            return new Response(JSON.stringify({ error: "No se proporcionó un archivo válido." }), { status: 400 });
        }
        
        const fileBuffer = Buffer.from(await imageFile.arrayBuffer());
        const bucket = adminStorage.bucket();
        const fileName = `images/gallery/${Date.now()}-${imageFile.name}`;
        const file = bucket.file(fileName);

        await file.save(fileBuffer, {
            metadata: { contentType: imageFile.type }
        });
        await file.makePublic();

        return new Response(JSON.stringify({ success: true, url: file.publicUrl() }), { status: 201 });

    } catch (error) {
        console.error("Error al subir imagen a la galería:", error);
        return new Response(JSON.stringify({ error: "No se pudo subir la imagen." }), { status: 500 });
    }
}
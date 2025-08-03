// src/pages/api/listings/index.js
import { getAllListingsServer, createListingServer } from '../../../lib/listings-crud-server.js';
import { authorizeAdmin } from '../../../lib/auth-middleware.js';
import { Buffer } from 'node:buffer';

export async function GET({ request }) {
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status });
  }
  try {
    // Usamos el nuevo nombre de la función
    const listings = await getAllListingsServer();
    return new Response(JSON.stringify(listings), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al obtener listings' }), { status: 500 });
  }
}

export async function POST({ request }) {
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status });
  }

  try {
    const formData = await request.formData();
    // Aquí extraes los datos del listing del formData
    const listingData = {
      translations: {
        es: { title: formData.get('title_es'), content: formData.get('content_es'), excerpt: formData.get('excerpt_es') },
        en: { title: formData.get('title_en'), content: formData.get('content_en'), excerpt: formData.get('excerpt_en') },
      },
      // ...otros campos...
    };

    const coverImageFile = formData.get('coverImageFile');
    let fileBuffer = null;
    if (coverImageFile && coverImageFile.size > 0) {
      fileBuffer = Buffer.from(await coverImageFile.arrayBuffer());
    }

    // Usamos el nuevo nombre de la función
    const listingId = await createListingServer(listingData, fileBuffer);
    return new Response(JSON.stringify({ success: true, listingId }), { status: 201 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al crear listing: ' + error.message }), { status: 500 });
  }
}
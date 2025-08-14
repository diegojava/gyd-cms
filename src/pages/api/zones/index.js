// src/pages/api/zones/index.js
import { getAllZonesServer, createZoneServer } from '../../../lib/zones-crud-server';
import { authorizeAdmin } from '../../../lib/auth-middleware';
import { Buffer } from 'node:buffer'; // Necesario para manejar archivos de FormData

export async function GET({ request }) {
  const authResult = await authorizeAdmin(request);
  console.log("API GET /api/zones: Authorization result:", authResult);

  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const zones = await getAllZonesServer();
    return new Response(JSON.stringify(zones), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API GET /api/zones error:', error);
    return new Response(JSON.stringify({ error: 'Error al obtener zonas' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST({ request }) {
  const authResult = await authorizeAdmin(request);
  console.log("API POST /api/zones: Authorization result:", authResult);

  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();

    const zoneData = {
      translations: {
        es: {
          title: formData.get('title_es'),
          description: formData.get('description_es'),
          excerpt: formData.get('excerpt_es'),
        },
        en: {
          title: formData.get('title_en'),
          description: formData.get('description_en'),
          excerpt: formData.get('excerpt_en'),
        },
      },
      pubDate: formData.get('pubDate'),
      // El 'id' de la zona no se envía desde el formulario, Firestore lo generará.
      // El 'slug' se generará en createZoneServer.
    };

    const coverImageFile = formData.get('coverImageFile');
    let fileBuffer = null;
    if (coverImageFile && coverImageFile.size > 0) {
      fileBuffer = Buffer.from(await coverImageFile.arrayBuffer());
    }

    const zoneId = await createZoneServer(zoneData, fileBuffer);

    // Después de que el post se creó correctamente, dispara el build.
    if (import.meta.env.NETLIFY_BUILD_HOOK) {
      await fetch(import.meta.env.NETLIFY_BUILD_HOOK, {
        method: 'POST'
      });
      console.log('Build de Netlify disparado por creación de post.');
    }

    return new Response(JSON.stringify({ success: true, zoneId }), {
      status: 201, // 201 Created
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API POST /api/zones error:', error);
    return new Response(JSON.stringify({ error: 'Error al crear zona: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
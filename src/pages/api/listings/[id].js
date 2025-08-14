// src/pages/api/listings/[id].js
export const prerender = false;

import { getListingByIdServer, updateListingServer, deleteListingServer } from '/src/lib/listings-crud-server';
import { authorizeAdmin } from '/src/lib/auth-middleware';
import { Buffer } from 'node:buffer';

// --- FUNCIÓN GET (YA ESTÁ CORRECTA) ---
export async function GET({ request, params }) {
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status });
  }

  try {
    const listingId = params.id;
    if (!listingId) {
      return new Response(JSON.stringify({ error: 'No se proporcionó un ID' }), { status: 400 });
    }
    const listing = await getListingByIdServer(listingId);
    if (!listing) {
      return new Response(JSON.stringify({ error: 'Listing no encontrado' }), { status: 404 });
    }
    return new Response(JSON.stringify(listing), { status: 200 });
  } catch (error) {
    console.error('Error en GET /api/listings/[id]:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
}

function generateSlug(title) {
  if (!title) return '';
  return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

export async function PUT({ request, params }) {
  // 1. Autorización del administrador
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status });
  }

  try {
    // 2. Validación del ID de la URL
    const listingId = params.id;
    if (!listingId) {
      return new Response(JSON.stringify({ error: 'No se proporcionó un ID para actualizar' }), { status: 400 });
    }

    // 3. Obtención de datos del formulario
    const formData = await request.formData();

    // 4. Lógica para generar el Slug
    const title_es = formData.get('title_es');
    const title_en = formData.get('title_en');
    const titleForSlug = title_es || title_en;

    // 5. Construcción manual y limpia del objeto de datos
    const dataToUpdate = {
      translations: {
        es: { title: title_es, content: formData.get('content_es'), excerpt: formData.get('excerpt_es') },
        en: { title: title_en, content: formData.get('content_en'), excerpt: formData.get('excerpt_en') },
      },
      price: Number(formData.get('price')), // Es buena práctica convertir a Número
      currency: formData.get('currency'),
      area: Number(formData.get('area')),
      bedrooms: Number(formData.get('bedrooms')),
      bathrooms: Number(formData.get('bathrooms')),
      parking: Number(formData.get('parking')),
      propertyType: formData.get('propertyType'),
      status: formData.get('status'),
      address: formData.get('address'),
      zoneId: formData.get('zoneId'),
      amenities: formData.getAll('amenities'), // Usamos getAll por si son varios checkboxes con el mismo nombre
      pubDate: formData.get('pubDate'),
      draft: formData.get('draft') === 'on',
      slug: {
        es: generateSlug(title_es),
        en: generateSlug(title_en),
      },
    };

    // 6. Lógica condicional para borrar la imagen
    if (formData.get('coverImage_clear_flag') === 'true') {
      dataToUpdate.coverImage = null;
    }

    // 7. Manejo del archivo de imagen por separado
    const coverImageFile = formData.get('coverImageFile');
    let fileBuffer = null;
    if (coverImageFile && coverImageFile.size > 0) {
      fileBuffer = Buffer.from(await coverImageFile.arrayBuffer());
    }

    // 8. Se actualiza el listing en la base de datos
    await updateListingServer(listingId, dataToUpdate, fileBuffer);

    // 9. Se dispara el build hook si la actualización fue exitosa
    if (import.meta.env.NETLIFY_BUILD_HOOK) {
      fetch(import.meta.env.NETLIFY_BUILD_HOOK, { method: 'POST' })
        .then(() => console.log('Build de Netlify disparado por actualización.'))
        .catch(err => console.error('Error al disparar build hook:', err));
    }

    // 10. Se devuelve una respuesta de éxito
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error('Error en PUT /api/listings/[id]:', error);
    return new Response(JSON.stringify({ error: 'Error al actualizar: ' + error.message }), { status: 500 });
  }
}
// --- FUNCIÓN DELETE (ACTUALIZADA Y HOMOLOGADA) ---
export async function DELETE({ request, params }) {
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) { return new Response(JSON.stringify({ error: authResult.message }), { status: authResult.status }); }

  try {
    const listingId = params.id;
    if (!listingId) {
      return new Response(JSON.stringify({ error: 'No se proporcionó un ID para borrar' }), { status: 400 });
    }

    await deleteListingServer(listingId);

    // Se añade el build hook también al borrar para actualizar la lista
    if (import.meta.env.NETLIFY_BUILD_HOOK) {
      fetch(import.meta.env.NETLIFY_BUILD_HOOK, { method: 'POST' })
        .then(() => console.log('Build de Netlify disparado por eliminación de listing.'))
        .catch(err => console.error('Error al disparar build hook:', err));
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error en DELETE /api/listings/[id]:', error);
    return new Response(JSON.stringify({ error: 'Error al borrar listing: ' + error.message }), { status: 500 });
  }
}
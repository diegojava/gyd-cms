// src/pages/api/listings/index.js
import {
  getAllListingsServer,
  createListingServer,
} from "../../../lib/listings-crud-server.js";
import { authorizeAdmin } from "../../../lib/auth-middleware.js";
import { Buffer } from "node:buffer";

// Esta función para obtener todos los listings no necesita cambios.
export async function GET({ request }) {
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), {
      status: authResult.status,
    });
  }
  try {
    const listings = await getAllListingsServer();
    return new Response(JSON.stringify(listings), { status: 200 });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Error al obtener los departamentos" }),
      { status: 500 },
    );
  }
}

// Esta función para crear un nuevo listing es la que actualizamos.
export async function POST({ request }) {
  const authResult = await authorizeAdmin(request);
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: authResult.message }), {
      status: authResult.status,
    });
  }

  try {
    const formData = await request.formData();

    // 1. Creamos un objeto con la nueva estructura de datos del departamento
    const listingData = {
      price: Number(formData.get("price")) || 0,
      currency: formData.get("currency") || "MXN",
      area: Number(formData.get("area")) || 0,
      bedrooms: Number(formData.get("bedrooms")) || 0,
      bathrooms: Number(formData.get("bathrooms")) || 0,
      parking: Number(formData.get("parking")) || 0,
      propertyType: formData.get("propertyType") || "departamento",
      status: formData.get("status") || "venta",
      address: formData.get("address") || "",

      // 2. Leemos TODAS las amenidades seleccionadas en un array
      amenities: formData.getAll("amenities"),

      draft: formData.get("draft") === "on",
      pubDate: formData.get("pubDate") || new Date().toISOString(),
      translations: {
        es: {
          title: formData.get("title_es"),
          description: formData.get("description_es"),
        },
        en: {
          title: formData.get("title_en"),
          description: formData.get("description_en"),
        },
      },
    };

    // 3. Manejamos la imagen de portada (sin cambios)
    const coverImageFile = formData.get("coverImageFile");
    let fileBuffer = null;
    if (coverImageFile instanceof File && coverImageFile.size > 0) {
      fileBuffer = Buffer.from(await coverImageFile.arrayBuffer());
    }

    // 4. Enviamos el nuevo objeto a la función que lo guardará en la base de datos
    const listingId = await createListingServer(listingData, fileBuffer);

    return new Response(JSON.stringify({ success: true, listingId }), {
      status: 201,
    });
  } catch (error) {
    console.error("Error creating listing in API route:", error);
    return new Response(
      JSON.stringify({
        error: "Error al crear el departamento: " + error.message,
      }),
      { status: 500 },
    );
  }
}
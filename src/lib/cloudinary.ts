import { supabase } from "./supabaseClient";

export async function uploadToCloudinary(
  file: File,
  folder: string
): Promise<{ url: string; publicId: string }> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  
  if (!cloudName) {
    throw new Error("Missing Cloudinary Cloud Name environment variable");
  }

  // 1. Fetch signature from Supabase Edge Function
  const { data, error } = await supabase.functions.invoke('sign-cloudinary', {
    body: { folder }
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to generate upload signature");
  }

  const { signature, timestamp, api_key } = data;

  // 2. Upload to Cloudinary using the signature
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", api_key);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  if (folder) {
    formData.append("folder", folder);
  }

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const json = await res.json();
  
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || "Cloudinary upload failed");
  }

  return { url: json.secure_url, publicId: json.public_id };
}

// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

async function sha1(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { folder } = await req.json();
    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    
    if (!apiSecret || !apiKey) {
      throw new Error("Missing Cloudinary credentials in edge function environment");
    }

    // Parameters to sign must be sorted alphabetically
    let paramsToSign = `timestamp=${timestamp}`;
    if (folder) {
      paramsToSign = `folder=${folder}&${paramsToSign}`; // 'f' comes before 't'
    }
    
    const signatureStr = paramsToSign + apiSecret;
    const signature = await sha1(signatureStr);
    
    return new Response(JSON.stringify({ signature, timestamp, api_key: apiKey }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

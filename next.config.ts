import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Los soportes se suben mediante una server action y el límite por
      // defecto es de 1 MB. 25 MB deja margen sobre el tope de 20 MB por
      // archivo más la sobrecarga del multipart.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 120, // يحتفظ بصفحة المنيو في cache المتصفح لمدة دقيقتين
    },
  },
};

export default nextConfig;

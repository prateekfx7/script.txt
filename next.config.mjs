/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Ignore server-only node native binaries (sharp, onnxruntime-node) in Webpack bundle
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;

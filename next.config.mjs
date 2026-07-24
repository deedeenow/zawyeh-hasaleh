/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Nothing is written to disk any more — the ledger lives in Sanity and this app
  // only reads it. That is what makes serverless hosting (Vercel/Netlify) viable.
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'coverartarchive.org', pathname: '/**' },
      { protocol: 'https', hostname: 'lastfm.freetls.fastly.net', pathname: '/**' },
      { protocol: 'https', hostname: 'i.scdn.co', pathname: '/**' },
    ],
  },
};

export default nextConfig;

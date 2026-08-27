/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@fullcalendar/core",
    "@fullcalendar/react",
    "@fullcalendar/timegrid",
    "@fullcalendar/interaction",
    "@fullcalendar/luxon3",
  ],
};

export default nextConfig;

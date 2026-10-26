import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not emit AGENTS.md / CLAUDE.md files during builds.
  agentRules: false,
};

export default nextConfig;

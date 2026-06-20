import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // This app is self-contained inside a larger repo. Pin file tracing to this
  // folder so Next doesn't pick the repo-root lockfile (the warning you saw) or
  // bundle the extension's files.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;

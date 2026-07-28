import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isProjectPage = Boolean(repositoryName) && !repositoryName.endsWith(".github.io");
const pagesBasePath =
  process.env.GITHUB_PAGES === "true" && isProjectPage ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  ...(process.env.GITHUB_PAGES === "true" ? { output: "export" as const } : {}),
  ...(process.env.GITHUB_PAGES === "true"
    ? { typescript: { tsconfigPath: "tsconfig.pages.json" } }
    : {}),
  basePath: pagesBasePath,
  assetPrefix: pagesBasePath,
  trailingSlash: true,
};

export default nextConfig;

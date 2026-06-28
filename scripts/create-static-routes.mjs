import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const indexHtml = join(projectRoot, "dist", "index.html");

const staticRoutes = ["career"];

await Promise.all(
  staticRoutes.map(async (route) => {
    const routeDir = join(projectRoot, "dist", route);
    await mkdir(routeDir, { recursive: true });
    await copyFile(indexHtml, join(routeDir, "index.html"));
  }),
);

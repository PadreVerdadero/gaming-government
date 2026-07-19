import { promises as fs } from "node:fs";
import path from "node:path";
import type { Chamber } from "../shared/types";

const DATA_DIR = path.join(process.cwd(), "data", "chambers");

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function chamberPath(code: string): string {
  return path.join(DATA_DIR, `${code.toUpperCase()}.json`);
}

export async function loadChamber(code: string): Promise<Chamber | null> {
  try {
    const raw = await fs.readFile(chamberPath(code), "utf8");
    return JSON.parse(raw) as Chamber;
  } catch {
    return null;
  }
}

export async function saveChamber(chamber: Chamber): Promise<void> {
  await ensureDir();
  const tmp = `${chamberPath(chamber.code)}.tmp`;
  const payload = JSON.stringify(chamber, null, 2);
  await fs.writeFile(tmp, payload, "utf8");
  await fs.rename(tmp, chamberPath(chamber.code));
}

export async function chamberExists(code: string): Promise<boolean> {
  try {
    await fs.access(chamberPath(code));
    return true;
  } catch {
    return false;
  }
}

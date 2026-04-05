import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/** Local Velo workspace data (.velo or VELO_DATA_DIR). */
export function veloDataDir(): string {
  const root = process.env.VELO_DATA_DIR ?? join(process.cwd(), '.velo');
  for (const sub of ['', 'chats', 'uploads']) {
    const p = sub ? join(root, sub) : root;
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }
  return root;
}

export function chatsDir(): string {
  return join(veloDataDir(), 'chats');
}

export function uploadsDir(): string {
  return join(veloDataDir(), 'uploads');
}

import 'server-only';
import { prisma } from './prisma';

export interface UiSettings {
  companyName: string;
  defaultAgentId: string;
  defaultCurrency: string;
  defaultActorRole: string;
}

const SINGLETON_ID = 'singleton';

export async function getUiSettings(): Promise<UiSettings> {
  const row = await prisma.appSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
  return {
    companyName: row.companyName,
    defaultAgentId: row.defaultAgentId,
    defaultCurrency: row.defaultCurrency,
    defaultActorRole: row.defaultActorRole,
  };
}

export async function setUiSettings(patch: Partial<UiSettings>): Promise<UiSettings> {
  const row = await prisma.appSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...patch },
    update: patch,
  });
  return {
    companyName: row.companyName,
    defaultAgentId: row.defaultAgentId,
    defaultCurrency: row.defaultCurrency,
    defaultActorRole: row.defaultActorRole,
  };
}

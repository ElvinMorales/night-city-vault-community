import type { Printing } from './types';
export function printingIdentity(p: Pick<Printing, 'gameplayCardId' | 'setCode' | 'collectorNumber' | 'treatment' | 'language'>): string {
  return JSON.stringify([p.gameplayCardId, p.setCode, p.collectorNumber ?? '', p.treatment, p.language]);
}

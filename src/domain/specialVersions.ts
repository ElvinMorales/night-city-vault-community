import type {Printing} from './types';
/** Only explicit treatment and promo fields establish physical attributes. Never infer from rarity or artwork. */
export function specialVersionLabels(p: Pick<Printing,'treatment'|'isPromo'>): string[] {
 const labels:string[]=[];
 for(const raw of p.treatment.split(/\s*\+\s*/)) {
  const part=raw.trim();
  if(!part || /^(unknown|regular|normal|non[- ]?foil|standard)$/i.test(part)) continue;
  labels.push(/^foil$/i.test(part)?'Foil':/^(holographic|holo)$/i.test(part)?'Holographic':/^promo$/i.test(part)?'Promo':/^stamped$/i.test(part)?'Stamped':part);
 }
 if(p.isPromo&&!labels.includes('Promo'))labels.push('Promo');
 return [...new Set(labels)];
}
/** Normalize only newly recorded token spelling/order; existing catalog values and IDs stay intact. */
export function treatmentTokens(value:string):string[] {
 return [...new Set(value.split(/\s*\+\s*/).map(s=>s.trim().toLowerCase()).filter(Boolean))].sort();
}
export function confirmedTreatment(parts:string[],other:string):string {
 return treatmentTokens([...parts.filter(p=>p!=='Promo'),other].join(' + ')).join(' + ')||'unknown';
}

import { assert, canonical } from '../storage/state';
import type { CollectionRepository } from '../storage/repository';
import { prepareCommand } from '../storage/indexeddb/repository';
import { planCatalog, type CatalogRelease } from './catalog';
/** Only unambiguous additions install automatically. Conflicts remain reviewable, never block inventory access. */
export async function installCatalog(repository:CollectionRepository,release:CatalogRelease) {
 const snapshot=await repository.readSnapshot();
 const plan=planCatalog(snapshot,release);
 const previous=(await repository.readCatalogReleases?.()??[]).find(r=>r.version===release.version);
 assert(!previous||canonical(previous)===canonical(release),'Catalog version reused with different content');
 if(previous&&!plan.some(r=>r.status==='new'))return {status:plan.some(r=>r.status!=='existing'||r.differences.length>0)?'review':'installed',plan};
 const result=await repository.execute(await prepareCommand(crypto.randomUUID(),{type:'catalog-release',release,choices:{cards:[],printings:[]}},[{entity:'revision',id:'collection',version:snapshot.revision}]));
 if(!result.ok)throw new Error(result.message);
 return {status:plan.some(r=>!['new','existing'].includes(r.status))?'review':'installed',plan};
}

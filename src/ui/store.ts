import type { Snapshot, EventRow } from '../domain/types';
import type { CommandBody, DomainCommand, CommandResult } from '../domain/commands';
import type { CollectionRepository } from '../storage/repository';
import { prepareCommand } from '../storage/indexeddb/repository';
export class CollectionStore {
 snapshot: Snapshot | null = null;
 events: EventRow[] = [];
 activityCommands:Record<string,CommandBody> = {};
 busy = false;
 error = '';
 message = '';
 notice = '';
 undo: {batchId:string;revision:number} | null = null;
 private listeners = new Set<() => void>();
 private refreshing: Promise<void> | null = null;
 private requested = false;
 constructor(readonly repository: CollectionRepository) {}
 subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
 private emit() { this.listeners.forEach(fn => fn()); }
 setDataBusy(busy:boolean) { this.busy=busy; if(busy){this.message='';this.error='';this.notice='';} this.emit(); }
 async reloadAfterRestore() { this.undo=null; this.events=[];this.activityCommands={}; await this.refresh(); }
 async refresh() {
  this.requested = true;
  if (this.refreshing) return this.refreshing;
  this.refreshing = (async () => {
   while (this.requested) {
    this.requested = false;
    const snapshot = await this.repository.readSnapshot();
    const additions = await this.repository.readEvents(0);
    this.snapshot = snapshot;
    this.events = additions.slice(-20);
    this.activityCommands = await this.repository.readActivityCommands?.(this.events.map(e=>e.batchId)) ?? {};
    if (this.undo && this.undo.revision !== snapshot.revision) { this.undo = null; this.notice = 'Your collection changed. Undo is no longer available for the previous change.'; }
    this.emit();
   }
  })();
  try { await this.refreshing; } finally { this.refreshing = null; }
 }
 async run(body: CommandBody, guards: DomainCommand['expectedVersions'] = []): Promise<boolean> {
  if (this.busy) return false;
  this.busy = true; this.error = ''; this.message = ''; this.notice = ''; this.emit();
  // Give React an opportunity to render before collection-sized command validation.
  await new Promise(resolve => setTimeout(resolve, 0));
  let result: CommandResult | undefined;
  try {
   result = await this.repository.execute(await prepareCommand(crypto.randomUUID(), body, guards));
   if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
   this.undo = result.undoable ? {batchId:result.batchId,revision:result.revision} : null;
   this.message = 'Saved on this device.';
   this.notice = body.type === 'undo' ? 'Last change undone' : body.type === 'quick-add' ? `${body.quantity} ${body.quantity===1?'copy':'copies'} added` : 'Change saved';
   await this.refresh();
   return true;
  } catch (e) {
   if(result?.ok){this.undo=null;this.notice='Change saved. Reload to see your collection.';}
   this.error = result?.ok ? 'Saved, but the collection could not refresh. Reload to inspect it.' : `${e instanceof Error ? e.message : 'Storage unavailable'}. No save confirmed. Refresh before retrying a conflict.`;
   if(body.type==='undo'&&!result?.ok){this.undo=null;this.notice='Undo could not be completed. Your collection may have changed. Review Recent Activity before trying again.';}
   if (!result?.ok) { try { await this.refresh(); } catch { /* retain visible error */ } }
   return false;
  } finally { this.busy = false; this.emit(); }
 }
}

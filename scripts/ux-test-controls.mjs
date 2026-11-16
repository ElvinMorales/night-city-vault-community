// Interact with the searchable picker; identifiers remain exact in test assertions.
export async function choosePrinting(ev,id){
 for(let i=0;i<500;i++){
  if(await ev(`!!document.querySelector('.picker-toggle')&&!document.querySelector('.picker-toggle').disabled`))break;
  await new Promise(r=>setTimeout(r,20));
 }
 await ev(`document.querySelector('.picker-toggle').click()`);
 for(let i=0;i<100;i++){
  if(await ev(`!!document.querySelector('.picker-options')`))break;
  await new Promise(r=>setTimeout(r,10));
 }
 await ev(`(()=>{const b=[...document.querySelectorAll('[data-printing-id]')].find(b=>b.dataset.printingId===${JSON.stringify(id)});if(!b)throw Error('Version missing '+${JSON.stringify(id)}+' available: '+[...document.querySelectorAll('[data-printing-id]')].map(b=>b.dataset.printingId).join(','));b.click();})()`);
 await new Promise(r=>setTimeout(r,20));
}

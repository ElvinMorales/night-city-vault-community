import type {Printing} from '../domain/types';
export function inCatalogContext(p:Printing,context:string){
 const english=/^(en|english)$/i.test(p.language);
 return context==='all'||(context==='retail'?p.setCode==='welcometonightcityretail'&&english:context==='beta'?/beta/i.test(p.setCode):context==='special'?p.isPromo||/promo|special|iconic/i.test(p.setCode+' '+p.treatment):context==='languages'?!english:false);
}

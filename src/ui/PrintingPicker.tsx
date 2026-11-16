import {useState,useRef} from 'react';
import {specialVersionLabels} from '../domain/specialVersions';
import type {Printing} from '../domain/types';
export function printingLabel(p:Printing){
 const family=p.setCode==='welcometonightcityretail'?'Retail':/beta/i.test(p.setCode)?'Beta':p.setName;
 const language=({en:'English',de:'German',fr:'French',es:'Spanish',it:'Italian',ja:'Japanese'} as Record<string,string>)[p.language]??p.language;
 return `${family} ${language} · ${p.collectorNumber?.startsWith('β')?'':'#'}${p.collectorNumber??'No number'}${specialVersionLabels(p).length?' · '+specialVersionLabels(p).join(' · '):''}`;
}
export function PrintingPicker({printings,value,onChange,preferred,disabled=false,unknownLabel='Not sure which version'}:{printings:Printing[];value:string;onChange:(id:string)=>void;preferred:(p:Printing)=>boolean;disabled?:boolean;unknownLabel?:string}){
 const toggle=useRef<HTMLButtonElement>(null);
 const choose=(id:string)=>{onChange(id);setOpen(false);toggle.current?.focus();};
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const current=printings.find(p=>p.id===value);
 const groups=new Map<string,Printing[]>();
 for(const p of [...printings].sort((a,b)=>Number(preferred(b))-Number(preferred(a)))){if(!`${printingLabel(p)} ${p.setName}`.toLowerCase().includes(query.toLowerCase()))continue;const group=`${preferred(p)?'This edition · ':''}${p.setName}`;groups.set(group,[...(groups.get(group)??[]),p]);}
 return <div className="printing-picker"><span className="field-label">Version</span><button type="button" ref={toggle} className="picker-toggle" aria-label={`Version: ${current?printingLabel(current):unknownLabel}`} disabled={disabled} aria-expanded={open} onClick={()=>{setOpen(!open);setQuery('');}}>{current?printingLabel(current):unknownLabel} <span aria-hidden="true">⌄</span></button>{open&&<section className="picker-options" aria-label="Choose a version"><label>Find a version<input autoFocus type="search" placeholder="Set, language or number" value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" data-printing-id="" aria-pressed={!value} onClick={()=>choose('')}>{unknownLabel}<small>{unknownLabel==='General card photo'?'Use for any version of this card.':'You can identify it later.'}</small></button>{[...groups].map(([group,items])=><div key={group}><h3>{group}</h3>{items.map(p=><button type="button" key={p.id} data-printing-id={p.id} aria-pressed={value===p.id} onClick={()=>choose(p.id)}>{printingLabel(p)}</button>)}</div>)}{groups.size===0&&<p>No versions match. Try a set or number.</p>}</section>}</div>;
}

export function SpecialBadges({printing}:{printing:Printing}){return <span className="special-badges">{specialVersionLabels(printing).map(label=><span className="special-badge" key={label}>{label}</span>)}</span>;}

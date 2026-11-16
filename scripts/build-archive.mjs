import { readFileSync,writeFileSync } from 'node:fs';
import { transformArchive } from '../src/catalog/archive.ts';
const catalog=transformArchive(JSON.parse(readFileSync('local-catalog/archive-metadata.json','utf8')));
writeFileSync('local-catalog/catalog.json',JSON.stringify(catalog,null,2)+'\n');
console.log(catalog.coverage);

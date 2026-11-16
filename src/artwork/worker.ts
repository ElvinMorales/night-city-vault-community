import {processImage} from './media';
self.onmessage=e=>{void processImage(e.data).then(result=>self.postMessage({result})).catch(error=>self.postMessage({error:String(error)}));};

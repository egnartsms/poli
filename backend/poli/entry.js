import * as rv from '$/reactive';


export { makeEntry };


function makeEntry(source) {
   let entry = rv.makeEntity();

   entry.source = source;

   return entry;
}

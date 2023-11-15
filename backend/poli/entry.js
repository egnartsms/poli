import { procedure, entity, runToFixpoint, externalEventHandler } from '$/reactive';

export { makeEntry };


function makeEntry(source) {
   let entry = entity();

   entry.source = source;

   return entry;
}

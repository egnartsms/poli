const {BOOTSTRAP_MODULE} = require('./const');


function loadPoli(rawModules) {
   console.time('load');

   let $_ = {
      matchAllHeaderBodyPairs,
      parseBody,
      // fs,  // FIXME: in Browser, that won't be available
      BOOTSTRAP_MODULE
   };

   let $ = Object.create(null);

   function moduleEval(code) {
      let fun = Function('$_, $', `"use strict"; return (${code})`);
      return fun.call(null, $_, $);
   }

   let entries = parseBody(rawModules[BOOTSTRAP_MODULE].contents);

   for (let [name, code] of entries) {
      $[name] = moduleEval(code);
   }

   let modules = $['load'](rawModules);
   console.timeEnd('load');
   return modules;
}


function parseBody(str) {
   const re = /^(\S+?)\s+::=(?=\s)/gm;
   // Here we parse loosely but still require at least 1 space before and after '::='.
   // (::= can actually be followed immediately by a newline which is a whitespace, too)
   return Array.from(matchAllHeaderBodyPairs(str, re), ([mtch, def]) => [mtch[1], def]);
}


/**
 * Parse any kind of text separated with headers into header/body pairs:
      HEADER ... HEADER ... HEADER ...

   Everything following a header before the next header or the end of string is considered
   a body that belongs to that header.
*/
function* matchAllHeaderBodyPairs(str, reHeader) {
   let prev_i = null, prev_mtch = null;

   for (let mtch of str.matchAll(reHeader)) {
      if (prev_mtch !== null) {
         yield [prev_mtch, str.slice(prev_i, mtch.index)];
      }
      prev_i = mtch.index + mtch[0].length;
      prev_mtch = mtch;
   }

   if (prev_mtch !== null) {
      yield [prev_mtch, str.slice(prev_i)];
   }
}


Object.assign(exports, {loadPoli});
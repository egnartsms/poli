-----

leaf ::= Symbol.for('poli.pyramid-leaf')


make ::=
   function (attrs) {
      return {
         attrs,
         root: {__proto__: null}
      }
   }


ensureSubnodeAt ::=
   function (node, attr, value) {
      if (node[attr] === undefined) {
         node[attr] = new Map;
      }

      let subnode = node[attr].get(value);

      if (subnode === undefined) {
         subnode = {__proto__: null};
         node[attr].set(value, subnode);
      }

      return subnode;
   }


setDefault ::=
   function (py, bindings, fnmaker=null) {
      let node = py.root;

      for (let attr of py.attrs) {
         if (Object.hasOwn(bindings, attr)) {
            node = $.ensureSubnodeAt(node, attr, bindings[attr]);
         }
      }

      if (node[$.leaf] === undefined) {
         node[$.leaf] = fnmaker();
      }

      return node[$.leaf];
   }


remove ::=
   :Remove a projection identified by `bindings` from the pyramid. The projection should exist in
    the pyramid.

   function (py, bindings) {
      let node = py.root;

      for (let i = 0; i < py.attrs.length; i += 1) {
         let attr = py.attrs[i];

         if (!Object.hasOwn(bindings, attr)) {
            continue;
         }

         let subnode = node[attr].get(bindings[attr]);

         node[attr].delete(bindings[attr]);
         if (node[attr].size === 0) {
            delete node[attr];
         }

         node = subnode;
      }

      delete node[$.leaf];
   }


matching ::=
   function* (py, rec) {
      function* go(node) {
         if (node[$.leaf] !== undefined) {
            yield node[$.leaf];
         }

         for (let attr in node) {
            // attr !== $.leaf because the 'for-in' loop does not iterate over symbols
            let subnode = node[attr].get(rec[attr]);
            
            if (subnode !== undefined) {
               yield* go(subnode);
            }
         }
      }

      yield* go(py.root);
   }


isEmpty ::=
   function (py) {
      for (let attr in py.root) {
         return false;
      }

      return true;
   }


empty ::=
   function (py) {
      py.root = {__proto__: null};
   }

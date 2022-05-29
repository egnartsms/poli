-----
functionalRelation ::=
   function ({name, attrs, instantiations}) {
      return {
         kind: 'func',
         name,
         attrs,
         instantiations,
      }
   }

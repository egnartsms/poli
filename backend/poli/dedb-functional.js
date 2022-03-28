-----
clsFuncRelation ::= ({
   name: 'relation.func',
   relation: true,
   'relation.func': true
})
functionalRelation ::= function ({name, attrs, instantiations}) {
   return {
      kind: 'func',
      name,
      attrs,
      instantiations,
   }
}

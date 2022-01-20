-----
clsFuncRelation ::= ({
   name: 'relation.func',
   relation: true,
   'relation.func': true
})
makeRelation ::= function ({name, attrs, instantiations}) {
   return {
      class: $.clsFuncRelation,
      name,
      attrs,
      instantiations,
   }
}

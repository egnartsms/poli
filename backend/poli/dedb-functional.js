dedb-goal
   funcGoal
-----
functionalRelation ::= function ({name, attrs, instantiations}) {
   return {
      type: $.RelationType.functional,
      name,
      attrs,
      instantiations,

      at(attrs) {
         return $.funcGoal(this, attrs);
      }
   }
}

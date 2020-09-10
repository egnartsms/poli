-----
rtdelta ::= new Map
delmark ::= Object.create(null)
rtget ::= function (module, name) {
   let delta = $.rtdelta.get(module);
   if (!delta || !(name in delta)) {
      return module.rtobj[name];
   }

   let val = delta[name];
   return val === $.delmark ? undefined : val;
}
rtset ::= function (module, prop, val) {
   let delta = $.rtdelta.get(module);
   if (!delta) {
      delta = new Object(null);
      $.rtdelta.set(module, delta);
   }

   delta[prop] = val;
}
applyRtDelta ::= function () {
   for (let [module, delta] of $.rtdelta) {
      for (let [prop, val] of Object.entries(delta)) {
         if (val === $.delmark) {
            delete module.rtobj[prop];
         }
         else {
            module.rtobj[prop] = val;
         }
      }
   }
   $.rtdelta.clear();
}
discardRtDelta ::= function () {
   $.rtdelta.clear();
}

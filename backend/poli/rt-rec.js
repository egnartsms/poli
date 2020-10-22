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
rtset ::= function (module, name, val) {
   let delta = $.rtdelta.get(module);
   if (!delta) {
      delta = new Object(null);
      $.rtdelta.set(module, delta);
   }

   delta[name] = val;
}
applyRtDelta ::= function () {
   for (let [module, delta] of $.rtdelta) {
      for (let [name, val] of Object.entries(delta)) {
         if (val === $.delmark) {
            delete module.rtobj[name];
         }
         else {
            module.rtobj[name] = val;
         }
      }
   }
   $.rtdelta.clear();
}
discardRtDelta ::= function () {
   $.rtdelta.clear();
}

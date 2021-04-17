-----
edit-entry ::=
   fun :(Rmodules (obj| (module: module-name) name new-defn))
      let module (module-by-name Rmodules module-name)
      let entry (entry-by-name module name)

      = new-defn (new-defn.trim)

      let new-val = (module-eval module.$ new-defn)

      = (@ module.delta name) new-val
      
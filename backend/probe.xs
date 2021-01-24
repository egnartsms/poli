lang-processor
   process
   flush
util
   rename
   with-flusher
   with-file
   * as: f
-----
remove-unused-imports-in-all-modules
   func :()
      let (<obj> removed-count affected-modules) =
         op-import.remove-unused-imports-in-all-modules

      op-ret
         <obj>
            removed-count
            modified-modules:
               Array.from affected-modules
                  fn :(module)
                     <obj>
                        module: module.name
                        import-section: (dump-import-section module)
                        modified-entries: (<arr>)

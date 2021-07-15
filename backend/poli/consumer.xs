-----
edit-entry ::=
   fun :(Rmodules (obj| (module: module-name) name new-defn))
      let module (module-by-name Rmodules module-name)
      let entry (entry-by-name module name)

      = new-defn (new-defn.trim)

      let new-val = (module-eval module.$ new-defn)

      = (@ module.delta name) new-val

      if
            and
               !== imports ximports
               not
                  and (empty? imports) (empty? ximports)
         mdelta.push
            obj|
               \ type: "replace-import-section"
               \ with:
               dump-import-section module.id xG

         mdelta.push (obj| (x: 20))

      let imports =
         trie.at G.imports.into module.id trie.make-empty
      let ximports =
         trie.at xG.imports.into module.id trie.make-empty
bootstrap
   lobby
xs-printer
   dumpsNext
-----
test1 ::= "test1"
test2 ::=
   func :()
      console.log "Finally you're getting to implement what you dreamt of"
      
      Furnicle? "Uncle"
test3 ::=
   func :(src-module entry dest-module)
      let refs = (extract-refs src-module entry)
      
      let offending-refs = (<arr>)
      let dangling-refs = (<arr>)
      let rename-map = (new Map)
      let imports-to-add = (<arr>)
      
      func rename :(from to)
         if (!== from to)
            rename-map.set from to
      
      func split-ref :(ref)
         let pref = (ref.split ".")
         let :(ref-module ref-name)
         
         if (=== pref.length 1)
            pref.unshift null
         
         return pref
      
      for (ref of: refs)
         let (<arr> ref-star ref-name) = (split-ref ref)
         let
            <obj>
               \ found
               module: o-module
               name: o-entry
               reduced: was-ref-reduced
            \ =
            resolve-reference src-module ref-star ref-name
         
         if (! found)
            dangling-refs.push ref
            continue
         
         if was-ref-reduced
            = ref ref-star
            = ref-name ref-star
         
         if (=== o-module dest-module)
            #; The reference "comes home"
            rename ref o-entry
            continue
         
         #; See whether the entry is already imported directly
         let (<obj> eimp simp) =
            reference-imports o-module o-entry dest-module
         
         if eimp
            rename ref (imported-as eimp)
            continue
         
         #; If not imported directly then the oModule may have already been star-imported
         if simp
            rename ref (joindot simp.alias o-entry)
            continue
         
         #; Must import it directly then
         if (is-name-free? dest-module ref-name)
          then:
            imports-to-add.push
               <obj>
                  recp: dest-module
                  donor: o-module
                  name: o-entry
                  alias: (?: (=== ref-name o-entry) null ref-name)
          else:
            offending-refs.push ref
         
         return
            <obj>
               \ offending-refs
               \ dangling-refs
               \ rename-map
               \ imports-to-add

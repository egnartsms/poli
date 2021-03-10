-----
a ::= 34
use-reverse ::=
   func :(arr)
    fucked:
      let len = (console console arr)
      console arr len (len arr "literal")
      
    var
      \ 20
gcd ::=
   func :((obj| (module: module-name) lang))
      if
            ||
               !== (typeof lang) "string"
               not (. (arr| "xs" "js") (includes lang))
         ()
         throw (new Error "Invalid module lang")
      
      if
            === syntax.stx "id"
         console.log "identifier"
       else-if:
            === syntax.stx "str"
         console.log "string"
       else-if:
            === syntax.stx "num"
         console.log "number"
       else:
         console.log "unknown"
      
      block|
         let counter = 0
         
         = driver.increase
            func :()
               += counter 1
      
      op-module/add-new-module module-name lang
      op-ret
replace-usages ::=
   func
         :
            obj| (module: module-name) name new-name
      let module = (module-by-name module-name)
      let modified-entries =
         op-refactor/replace-usages module name new-name
      
      op-ret
         obj|
            import-section: null
            modified-entries
test ::=
   func :()
      let ar = (arr|)
      let i = 0
      
      for :(ar@i of: (get-all-of-them))
         console.log (@ ar i)
ort-by ::=
   func :(dir)
      return
         Vec (Math.cos dir) (Math.sin dir)
wrap-dir ::=
   func :(dir)
      if (< dir (- Math.PI))
       then:
         return (+ dir (* 2 Math.PI))
       else-if:
            > dir Math.PI
         return (- dir (* 2 Math.PI))
       else:
         return dir
vec-by ::=
   func :(dir magn)
      return
         vec-mult-scalar (ort-by dir) magn
processor ::=
   syntax-rules :(stx)
         \ a
      b
      c
      d
      e
         f
         g
      h
         i
update ::=
   func :(man dt)
    pre:
      skater? man
      > dt 0
    post:
      and
         within-rink? man.x
         within-rink? man.y
    body:
      update-pos man dt
      
      if (null? man.driver)
         return
      
      let dir = (man.driver)
      
      while (function? dir)
         = man.driver dir
         = dir (man.driver)
      
      if (null? dir)
         set-driver man null
         return
      
      = man.dir dir
      
      if (! (is-finite man.dir))
       then:
         if (! (isNaN man.dir))
            if (isNaN (geo/dir man.v))
             then:
               = man.dir NaN
             else:
               = man.dir (geo/wrap-dir (+ (geo/dir man.v) Math.PI))
            
            const speed = (geo/magnitude man.v)
            const delta = (* dt man.maxdec)
            
            if (> delta speed)
             then:
               = man.v (geo/Vec 0. 0.)
             else:
               = man.v (geo/ofmagn man.v (- speed delta))
       else:
         const acc = (acc-max-vector man.dir man)
         = man.v
            geo/clamp-magnitude
               vec-add-mult man.v dt acc
               \ man.max-speed
rename-refs-in ::=
   func :(module rename-map)
      #; TODO: impelement reference renaming for xs
      if
            === module.lang "xs"
         return (arr|)
      
      func escape :(ref)
         return (ref.replace h/./g "\\.")
      
      if
            instanceof rename-map Array
         if
          else:
               &&
                  === (typeof (@ rename-map 0)) "string"
                  === rename-map.length 2
                  + a
                unless:
                     fuck
                  normally-indented-code
                  and-more
            = rename-map (arr| rename-map)
      
      let alts = (Array.from (rename-map.keys) escape)
      
      if (=== alts.length 0)
         return (arr|)
      
      let re = (new RegExp "...")
      let modified-entries = (arr|)
      
      for (entry of: module.entries)
       body:
         let old-source = (@ module.defs entry)
         let new-source =
            old-source.replace
               \ re
               fn :(ref) (rename-map.get ref)
         
         if (=== old-source new-source)
            continue
         
         let new-val = (module-eval module new-source)
         
         set-object-prop module.defs entry new-source
         rtset module entry newval
         propagate-value-to-recipients module entry
         
         modified-entries.push (arr| entry new-source)
      
      
      return modified-entries

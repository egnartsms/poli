-----
use-reverse ::=
   func :()
      reverse "Hey there"
gcd ::=
   func :((obj| (module: module-name) lang))
      if
            ||
               !== (typeof lang) "string"
               not (. (arr| "xs" "js") (includes lang))
         throw (new Error "Invalid module lang")
      
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
rename-refs-in ::=
   func :(module rename-map)
      #; TODO: impelement reference renaming for xs
      if (=== module.lang "xs")
         return (arr|)
      
      func escape :(ref)
         return (ref.replace h/./g "\\.")
      
      if (instanceof rename-map Array)
         if
               &&
                  === (typeof (@ rename-map 0)) "string"
                  === rename-map.length 2
            = rename-map (arr| rename-map)
      
      let alts = (Array.from (rename-map.keys) escape)
      
      if (=== alts.length 0)
         return (arr|)
      
      let re = (new RegExp "...")
      let modified-entries = (arr|)
      
      for (entry of: module.entries)
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
       else:
         if (> dir Math.PI)
          then:
            return (- dir (* 2 Math.PI))
          else:
            return dir
vec-by ::=
   func :(dir magn)
      return
         vec-mult-scalar (ort-by dir) magn
update ::=
   func :(man dt)
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
update-pos ::=
   func :(man dt)
      let newpos = (vec-add-mult man.pos dt man.v)
      let deflected = false
      
      func face-line-bump :(line-x)
         const vy = man.v.y
         = man.pos (geo/Vec line-x (+ man.pos.y (* vy dt)))
         = man.v (geo/Vec 0 vy)
      
      func side-line-bump :(line-y)
         const vx = man.v.x
         = man.pos (geo/Vec (+ man.pos.x (* vx dt)) line-y)
         = man.v (geo/Vec vx 0)
      
      cond
         if: (<= newpos.x rink/*left-rx*)
            cond
               if: (< newpos.x *min-x*)
                  face-line-bump *min-x*
                  = deflected true
               if: (>= newpos.y rink/*upper-ry*)
                  = deflected
                     check-bump-arc man newpos dt rink/*c-left-upper*
               if: (<= newpos.y rink/*lower-ry*)
                  = deflected
                     check-bump-arc man newpos dt rink/*c-left-lower*
         if: (>= newpos.x rink/*right-rx*)
            cond
               if: (> newpos.x *max-x*)
                  face-line-bump *max-x*
                  = deflected true
               if: (>= newpos.y rink/*upper-ry*)
                  = deflected
                     check-bump-arc man newpos dt rink/*c-right-upper*
               if: (<= newpos.y rink/*lower-ry*)
                  = deflected
                     check-bump-arc man newpos dt rink/*c-right-lower*
         if: (< newpos.y *min-y*)
            side-line-bump *min-y*
            = deflected true
         if: (> newpos.y *max-y*)
            side-line-bump *max-y*
            = deflected true
      
      if (! deflected)
         = man.pos newpos

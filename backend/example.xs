process-all
   fn :(event num)
      if (> (.length event) num);
       then:
         do-1 "fuck\" you"
         let
            :
               x y
            *
               + x y 1
               \ 2
               \ 30
       else:
         do-3
         define
            \ "Doc string looks like this"
            fuck:
               luck-2 arg1 arg2 arg3
         do-4
            while (< a b);
               go-ahead! fuck
            while
                  \ true
               #; this is a comment
               = a (+ a 1)
process-env!
   fn :(locality)
      #; locality
         drepissire
         fearsome of you

      + locality 1
map
   fn :(coll func)
      if (Array.isArray coll)
       then:
         return (coll.map func)
       else:
         let res = []
         for :(x coll)
            res.push (func x)
         return res
n 10
m (* n 2)
func
   ... n ... m ...
   . x
   window.addEventListener
      fn :()
         if (=== this.target btn-cancel)
          then:
            console.log "Operation is cancelled"
          else:
            await
               operation-proceed arg-1 arg-2
            console.log "Operation is completed!"

         return result
      \ interval

Athlete
   class
      ...
      ...

      givePass() {
         ...
      }

      ...
      ...


inter
   fn
         : config (<arr> v0 v1 v2)
      <obj>
         config0: (<arr> (@ config 0) v0)
         config1: (<arr> (@ config 1) v1)
         config2: (<arr> (@ config 2) v2)
   fn :(config flush)
      let :(x = 1) :(y = 20)
        in:
         console.log x y

      let
         : x = (.x config)
         : y = (.y config)
         : sum =
            + x y
         : (<arr> rot-x rot-y scale-x scale-y) = (transform-matrix config)
         :
            <arr> rot-x rot-y scale-x scale-y
            \ =
            transform-matrix config
       in: 
         console.log "You got: " x y sum
         return

      cond
         if: (good-enough? config) then:
            ...
            ...
            ...

         if:
            and
               too-small? config eps
               >=
                  \ eps 
                  get-critical-epsilon config
           then:
            ...
            ...
            ...
            ...

      let*
         : simp-path = (simplify-path path #f)
         : b = (path->bytes simp-path)
       in:
         for/or :(skip-path (in-list skip-paths))
            let len = (bytes-length skip-path)
            and
               >= (bytes-length b) len
               bytes=? (subbytes b 0 len) skip-path
               let-values
                  : :(base name dir?) (split-path simp-path)
                  or
                     and
                        path? base
                        file-stamp-in-paths simp-path (list base)
                     cons -inf.0 ""

      cond
         if: (not mred?)
           then: 
            string-append "racket" (variant-suffix variant #f)

         if: (simple-enough? value) 'simple'

         if: (simple-enough? value)
            \ 'simple'

         if: (simple-enough? value)
            console.log "Found a simple solution"
            return 'simple'

         if:
               or
                  and 
                     not untethered?
                     find-addon-tethered-console-bin-dir
                     find-config-tethered-console-bin-dir
                  find-console-bin-dir
            build-path
               format `Gracket${}.app` sfx
               \ "Contents"
               \ "MacOS"
               format `Gracket${}` sfx

         else:
            ...
            ...
            ...

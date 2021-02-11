-----
zip ::=
   func* :(seq1 seq2)
      let it1 =
         call| (@ seq1 Symbol.iterator)
      let it2 =
         call| (@ seq2 Symbol.iterator)
      
      forever
         let (o| value: item1 done: done1) = (it1.next)
         let (o| value: item2 done: done2) = (it2.next)
         
         if (&& done1 done2)
            break
         
         if done1
            = item1 null
         
         yield (a| item1 item2)
reverse ::=
   func :(arr)
      let i = 0
      let j = (- arr.length 1)
      
      while (< i j)
         = (a| arr@i arr@j) (a| arr@j arr@i)
         
         = i (+ i 1)
         = j (- j 1)
      
      = (@ arr (+ i 1)) 0
      =
         @ arr (+ i 1)
         \ 0
      
      -->
         $ ".item .nested-basket"
         .closest
         .select "..."
      
      console.log A@i
      console.log (@i A)
      console.log (A@ i)
      console.log (@ A i)
      
      console.log (A@handler process env)
      #; The following is the same but does not pass A as this
      console.log ((@ A handler) process env)
      console.log (@ A (handler process env))
      
      console.log A@i@j
      console.log (A@i@ j)
      console.log (@i@i A)
      console.log (@ (@ A i) j)
      console.log (@ A i j)
      
      #; obj.meth1(a11, a12).meth2(a21, a22).meth3(a31, a32)
      console.log (. (. (. obj (meth1 a11 a12)) (meth2 a21 a22)) (meth3 a31 a32))
      console.log (. obj (meth1 a11 a12) (meth2 a21 a22) (meth3 a31 a32))
      console.log
         . obj
            meth1 a11 a12
            meth2 a21 a22
            meth3 a31 a32
      
      #; A[x][y][z]
      console.log A@x@y@z
      console.log (@ A x y z)
      console.log (@ (@ (@ A x) y) z)
      
      #; A[handler]
      (@ obj handler)
      #; A[getHandler()]
      (@ obj (get-handler))
      #; A[handler]()
      c| (@ obj handler)
      #; A[getHandler()]()
      +
         c| (@ A (get-before-handler))
         c| (@ A (get-after-handler))
         c| (@ A (get-cleanup-handler))

      . obj (meth 1 2 3)
      pc| (. obj meth) 1 2 3

      (@ A (get-prop)) arg1 arg2
      (A@ (get-prop)) arg1 arg2
      
      
      console.log
         \ obj.prop (. obj prop) (.prop obj)
         \ (obj.meth a1 a2) (. obj (meth a1 a2))
test1 ::= "test1"
test2 ::=
   func :()
      console.log "Finally you're getting to implement what you dreamt of"
      
      Furnicle? "Uncle"
      
      if (really-you?)
       then:
         console.log "Serhio"
       else:
         console.log "Ramos"
test3 ::=
   func :(src-module entry dest-module)
      let refs = (extract-refs src-module entry)
      \ 
      
      let offending-refs = (arr|)
      let dangling-refs = (arr|)
      let rename-map = (new Map)
      let imports-to-add = (arr|)
      
      func rename :(from to)
         if (!== from to)
            rename-map.set from to
      
      func split-ref :(ref)
         let pref = (ref.split ".")
         let :(ref-module ref-name)
         
         if (=== pref.length 1)
            pref.unshift null
         
         return pref
      
      for :(ref refs)
         let (-arr- ref-star ref-name) = (split-ref ref)
         let
            obj|
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
         let (-obj- eimp simp) =
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
               obj|
                  \ recp: dest-module
                  \ donor: o-module
                  \ name: o-entry
                  alias:
                     ?
                        === ref-name o-entry
                        \ null
                        \ ref-name
          else:
            offending-refs.push ref
         
         return
            -obj-
               \ offending-refs
               \ dangling-refs
               \ rename-map
               \ imports-to-add
%delay_24 ::=
   func :()
      ...
      -arr-
         \ 10
         \ 20
         \ 30
         \ 40
      
      -obj-
         \ name: 30
         \ surname: "Vashua"
      
      window.set-timeout
         fn :()
            let
                  :
                     : (-obj- (employee-name: name)) X
                     : i 0
                     : j (+ i 1)
               console.log i j
            let tmp = (-arr-)
            render
               h unwrapper (-arr- 1 2 3)
               \ document.body
         2000

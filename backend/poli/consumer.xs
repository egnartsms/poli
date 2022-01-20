-----
empty-root ::=
   fun (:)
      Object.assign (%arr)
         %obj | leaf? true
                fresh? true
                min-key null
                max-key null
                size 0
freeze ::=
   fun (: root)
      if (not root.fresh?)
         return

      fun freeze :(node)
         set! node.fresh? false
         case | if: (negative? x)
                   console.log "< 0"
                if: (zero? x)
                   console.log "= 0"
                else:
                   console.log "neither"
         (with ([x 0] [y (+ x 1)])
            (console.log x y)
            )

         _ | subres = | gl-render | + x 1
                                    + y 1
                                    \ -2
                                    \ -2
            console.log subres

         with | : x 10
                : y (+ x 1)
            console.log x y

         check-like
            new Set | query continent-city (obj%)
            arr%
               obj% -(continent: "Europe") -(city: "Paris")
               obj% -(continent: "Europe") -(city: "Marseille")
               obj% -(continent: "Europe") -(city: "Lyon")
               ...

         let proj | get-derived-projection continent-city (obj%)

         check (=== proj.records.size 25)

         let f-europe
            query-one continent (obj% -(name: "Europe"))

         remove-fact continent f-europe
         update-projection proj

         check | === proj.records.size 16

         add-fact | \ city
                    obj%
                       - country: "Ruthenia"
                       - name: "Chernivtsi"
                       - population: 0.400








         (let D (- (** b 2) (* 4 a c)))
         let D = | - (** b 2) (* 4 a c)

         let D = (- (** b 2) (* 4 a c))
         let D = b ** 2 - 4 * a * c
         let X =
            xml
               <head>
                  text Header: ${(user.name)}
                  <table>
                     for | @arr a b
                           \ of: (get-names)
                        xxx


                     for :((@arr a b) of: (get-names))
                        <tr>
                           <td>

            

         case (customer-name John)
            if: *("first" "second" "third")
               console.log Get-me
            if: "joshua"
               ...
            else:
               ...

         if (! node.leaf?)
            for subnode in: node
               if subnode.fresh?
                  freeze subnode

      freeze root


edit-entry ::=
   f | (vec x y z) velocity dt
      console.log | + x y z

   fun | vec x y z
         \ velocity
         \ dt

   fun | : Rmodules
            obj% | | |
      : Rmodules (%obj (module: module-name) name new-defn)
      let module = (module-by-name Rmodules module-name)
      let entry = (entry-by-name module name)
      
      = new-defn (new-defn.trim)
      
      let new-val = (module-eval module.$ new-defn)
      
      = (@ module.delta name) new-val
      
      def (get-them :(a 10) :(b 20))
         console.log a b " and all the rest"

      def | get-them (a 10) (b 20)
          | first statement
          |    \ of the body
         i am body
      
      let check-right
         fun :(path)
            or
               ...
               ...
               
      let | : :(x 0) :(y (+ x 1))
               :> z (* x y)
         console.log x y

      let | :
          |    : x 10
          |    : y (+ x 1)
         + x y

      let | :
               : x 10
               : y | + x 1
               : z | same-as-x-or-y-but-as-body
         + x y



      let | :
               : x 10
               : y (+ x 1)
         + x y

      let | : | : x 10
                : y (+ x 1)
               : z (+ x y)
            first-body-member
         second-body-member
         ...



      cond
         if: | if | on-mac-os?
                  then: | eq os "macosx"
                  else: | eq os "linux"
            return "native"
         else:
            return "emulation"

      cond
         if: | index-more-specific? idx1 idx2
            \ idx1

         if: | index-more-specific? idx2 idx1
            \ idx2

         otherwise:
            throw | new | Error "Bad thing happened"
      let | :  | : x 20
                 : y | + x 30
               : z | + x y 1
         console.log x y z

      for | (:arr x y) points
         console.log "x =" x
         console.log "y =" y

      loop | : sub-projs sub-projs
             : sub-versions (:arr)
             : i 0
             : ns (Object.fromEntries (zip names values))
         do-1
         do-2
         cond
            if: | condition-1 arg-1
               recur

      let
         -
            - x 20
            - y (+ x 30)
         * x y -.5 -.8
      
      if
            and
               !== imports ximports
               not
                  and (empty? imports) (empty? ximports)
       then:
         mdelta.push
            :obj | type: "replace-import-section"
                   with: | dump-import-section module.id xG
      
         mdelta.push (obj| x: 20)
       + 10 20
       - x y
      
      let imports =
         trie.at G.imports.into module.id trie.make-empty
      let ximports =
         trie.at xG.imports.into module.id trie.make-empty
      
      case
         if: | and
                  index-more-specific?
                     get-intrinsic-index (@ A 0)
                     get-intrinsic-index (@ A 1)
                  <= (get-num-indexes) 2 |
            \ idx1
         if:
               index-more-specific? idx2 idx1
            \ idx2
         otherwise:
            console.log "Miss"

version-removed-keys ::=
   function :(ver)
      case
         if: | === ver.class cls-rec-key-bound-version
            let (obj% -(proj: proj)) ver

            if | &&
                    !== ver.rval proj.rval
                    !== ver.rval undefined
               return (arr% proj.rkey)
               return (arr%)

         if: | === ver.class ...
            #; Fucking shit
               Do hast mich gefragt


define (compile-to-zo src dest namespace eval? verbose? mod?)
   :call | if eval?
              then:
                 lambda :(t)
                    parameterize | : read-accept-reader #t
                       :call t
              else:
                 \ with-module-reading-parameterization
      lambda :()
         parameterize | : current-namespace namespace
            compile-file src dest
               compose
                  if eval?
                     then:
                        lambda :(expr)
                           expand-syntax-top-level-with-compile-time-evals expr
                     else:
                        \ values
                  if mod?
                     then:
                        lambda :(expr)
                           check-module-form
                              \ expr
                              let-values | : :(base name dir?) (split-path src)
                                 string->symbol
                                    path-element->string
                                       path-replace-suffix name #""
                              \ src
                     else:
                        \ values


define (compute-paths root-goal)
   let (:arr goal-paths path-goals) (many2many)
   let goals (:arr)

   let walk
      fun :(goal K)
         cond
            if: | `||`
                     === goal.type GoalType.rel
                     === goal.type GoalType.func
               goals.push goal
               K
               goals.pop goal

            if: | === goal.type GoalType.and
               :call
                  fun rec :(chain)
                     if (=== chain null)
                        then: (K)
                        else:
                           walk chain.item
                              fun :()
                                 rec (chain.next)
                  array-chain goal.subgoals
            if: | === goal.type GoalType.or
               for disjunct of: goal.subgoals
                  walk disjunct K
            else:
               throw | new | Error

   let path-num 0

   walk
      \ root-goal
      fun :()
         m2m-add-all path-goals path-num goals
         += path-num 1

   assert | === goals.length 0

   return | :obj | goal-paths
                   path-goals
                   num-paths: path-num


define (register-proj-num-index registry proj-num index)
   let n
      registry.findIndex
         fun | :  | :obj | proj-num: x-proj-num
                           index: x-index
            && | === x-proj-num proj-num
                 arrays-equal? x-index index

   if (!== n -1)
      return n

   registry.push (:obj (proj-num: proj-num) (index: index))
   return | - registry.length 1

define | narrow-config config0 bind-list
   let | :obj plan applied-indices
      narrow-join-plan | \ config0.plan
                         \ config0.applied-indices
                         \ bind-list

   return
      :obj
         attrs:
            config0.attrs.filter
               func :(a)
                  ! | bind-list.includes a
         plain-attrs:
            if | === config0.plain-attrs null
               then: null
               else: | config0.plain-attrs.filter
                          fun :(a)
                             ! | bind-list.includes a
         vars:
            config0.vars.filter | fun :(lvar)
                                      ! (bind-list.includes lvar)
         applied-indices:
            \ applied-indices
         plan:
            \ plan

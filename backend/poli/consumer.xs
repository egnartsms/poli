-----
pack-add-index ::=
   func :(pack index)
      check | ! (pack.has index.tuple.key)
              func "Duplicate index within pack"

      pack.set index.tuple.key index

      if | && | !== pack.shortest null
                < index.tuple.length pack.shortest.tuple.length
         = pack.shortest index


build-tree-1 ::=
   func :(root-0)
      let convert-rel
         func :(goal-0)
            return
               obj%
                  rel: goal-0.rel
                  entity-var: goal-0.entityVar
                  firm-bindings: goal-0.firm-bindings
                  loose-bindings: goal-0.loose-bindings

      let convert-conj
         func :(goal-0)
            let choices (%arr)
            let leaves (%arr)

            for sub0 goal-0.conjuncts
               if | === sub0.kind "or"
                  choices.push | convert-disj sub0
               elif | === sub0.kind "rel"
                  leaves.push | convert-rel sub0
               else
                  throw | new Error "Programming error"

            return | obj% choices leaves

      let convert-disj
         func :(goal-0)
            let alts (%arr)

            for sub0 | get-goal-disjuncts goal-0
               let sub1

               if | === sub0.kind "rel"
                  = sub1 | obj% | choices: | arr%
                                  leaves: | arr% | convert-rel sub0
               elif | === sub0.kind "and"
                  = sub1 | convert-conj sub0
               else
                  throw | new Error "Programming error"


tuple-fitness ::=
   func :(tuple bounds)
      let lim | Math.min tuple.length bounds.length
      let i 0

      while | && | < i lim
                   ref bounds i
         += i 1

      let diff | - i tuple.length

      return
         if | === i 0
            then:
               ?: tuple.is-no-match-fine? diff Fitness.minimum
            else:
               ?: ...


index-remove ::=
   func :(index rec :(attrs rec))
      let (obj% tuple) index

      func go :(node level)
         let key | ref attrs | ref tuple level

         check | node.has key
                 \ "Index missing record"

         if | === (+ level 1) tuple.length
            if tuple.isUnique
               check | 

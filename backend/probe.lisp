(define process-all
  (fn [event num]
    (if (> (. length event) num)
      (block
        (do-1)
        (do-2))
      (block
        (do-3)
        (define 2 10)
        (do-4 (while (< a b) (go-ahead!)))))))

(define process-env!
  (fn [locality]
    (+ locality 1)))

(define process-furniture
  (* a b))

(define delete-array-item 
  (fn [ar i]
    (assert (. obj2id (has ar)))

    (. stmtDeleteProp (run #{[oid: (. obj2id (get ar))] [path: (jsonPath i)]}))
    (. ar (splice i 1))))

(define sample
  (block
    (let name "John")
    (let age 25)
    (let role "Sales manager")
    #{[name: (+ name "!")] age role}
    ))

(define sample-2
  (block
    (let* [[fear "Hey"]
           [gear "Fey"]]
      (+ fear gear))))

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

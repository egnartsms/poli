test
   reverse
-----
use-reverse ::=
   func :()
      reverse "Hey there"
gcd ::=
   func :(a b)
      if (> a b)
         swap! a b
      while (!== a 0)
         = b (% b a)
         if (> a b)
            swap! a b
      return b

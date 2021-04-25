common
   arraysEqual
   assert
   equal
   lessThan
   map
trie
   * as: trie
vector
   * as: vec
xs-printer
   multilined2str
xs-reader
   read1FromString
xs-tokenizer
   tokenizeFromNewline
-----
text ::= String.raw`
 square-equation ::=$
   fn :(a b c)
      let D =
         -
            Math.pow b 2
            * 4 a c
      
      cond
            extra-indented-stuff
         normally-indented-stuff
         and-more
         
       default-body:
         if:
               < D 0
            return (<arr>)
         
         if: (= D 0)
            return
               <arr>
                  / (- b) (* 2 a)
         
         \ 
         \ 
         
         otherwise:
            return
               <arr>
                     "double indentation"
                  /
                     + (- b) (Math.pow D .5)
                     * 2 a
                  /
                     - (- b) (Math.pow D .5)
                     * 2 a
`.slice(2)
text1 ::= 'that will be set at runtime'
testTok ::= function () {
   console.time();
   for (let i = 0; i < 10_000; i += 1) {
      let gtor = $.tokenizeFromNewline($.text);
      let arr = Array.from(gtor);
      if (arr.length > 1_000_000) {
         console.log("I will never be reached!")
      }
   }
   console.timeEnd();
}
testReader ::= function () {
   let obj1 = $.read1FromString($.text);
   $.text1 = $.multilined2str(obj1) + '\n';
   
   console.log("$.text1 === $.text", $.text1 === $.text);
}
addDiv ::= function () {
   let div = document.createElement('div');
   div.innerText = 'I am a div!!';
   document.body.appendChild(div);
}
allKeys ::= [
   'one',
   'two',
   'three',
   'four',
   'five',
   'six',
   'seven',
   'eight',
   'nine',
   'ten',
   'eleven',
   'twelve',
   'thirteen',
   'fourteen',
   'fifteen',
   'sixteen',
   'seventeen',
   'eighteen',
   'nineteen',
   'twenty',
   'twenty-one',
   'twenty-two',
   'twenty-three',
   'twenty-four',
   'twenty-five',
   'twenty-six',
   'twenty-seven',
   'twenty-eight',
   'twenty-nine',
   'thirty',
   'thirty-one',
   'thirty-two',
   'thirty-three',
   'thirty-four',
   'thirty-five',
   'thirty-six',
   'thirty-seven',
   'thirty-eight',
   'thirty-nine',
   'forty',
   'forty-one',
   'forty-two',
   'forty-three',
   'forty-four',
   'forty-five'
]
allValues ::= [
   'un',
   'deux',
   'trois',
   'quatre',
   'cinq',
   'six',
   'sept',
   'huit',
   'neuf',
   'dix',
   'onze',
   'douze',
   'treize',
   'quatorze',
   'quinze',
   'seize',
   'dix-sept',
   'dix-huit',
   'dix-neuf',
   'vingt',
   'vingt et un',
   'vingt-deux',
   'vingt-trois',
   'vingt-quatre',
   'vingt-cinq',
   'vingt-six',
   'vingt-sept',
   'vingt-huit',
   'vingt-neuf',
   'trente',
   'trente et un',
   'trente-deux',
   'trente-trois',
   'trente-quatre',
   'trente-cinq',
   'trente-six',
   'trente-sept',
   'trente-huit',
   'trente-neuf',
   'quarante',
   'quarante et un',
   'quarante-deux',
   'quarante-trois',
   'quarante-quatre',
   'quarante-cinq'
]
perfTrie ::= function () {
   let map = $.trie.Trie({
      keyof: ([k, v]) => k,
      less: $.lessThan
   });
   
   let M = $.allKeys.length;
   for (let i = 0; i < M; i += 1) {
      $.trie.add(map, [$.allKeys[i], $.allValues[i]]);
   }

   $.trie.freeze(map);
   
   const N = 1_000_000;
   console.time();
   for (let i = 0; i < N; i += 1) {
      let ikey = Math.floor(Math.random() * M);
      let ival = Math.floor(Math.random() * M);
      map = $.trie.newIdentity(map);
      $.trie.add(map, [$.allKeys[ikey], $.allValues[ival]]);
      $.trie.freeze(map);
      
      let s = $.trie.find(map, $.allKeys[Math.floor(Math.random() * M)]);
      if (s[0] === 'a') {
         console.log(s);
      }

   }
   console.timeEnd();
}
check ::= function (pred, arg1, arg2) {
   if (!pred(arg1, arg2)) {
      console.log(`Assertion failure: ${pred.name} on`, arg1, arg2);
      throw new Error();
   }
}
testTrie ::= function () {
   let t = $.trie.Trie({
      keyof: ([k, v]) => k,
      less: $.lessThan
   });
   
   $.trie.add(t, ['germany', 'allemagne']);
   $.trie.add(t, ['spain', 'espagne']);
   $.trie.add(t, ['england', 'angleterre']);
   $.trie.add(t, ['russia', 'russie']);
   $.trie.add(t, ['italy', 'italie']);

   $.check(
      $.arraysEqual,
      Array.from($.map(([k, v]) => k, $.trie.items(t))),
      ['england', 'germany', 'italy', 'russia', 'spain']
   );

   $.trie.removeByKey(t, 'england');
   $.trie.removeByKey(t, 'germany');
   $.trie.removeByKey(t, 'russia');
   $.trie.removeByKey(t, 'spain');
   $.trie.removeByKey(t, 'italy');

   $.check($.equal, t.root, null);

   console.log("Trie checkup done!")
}
testVector ::= function () {
   let v = $.vec.Vector();

   for (let i = 0; i < $.vec.MAX_NODE_SIZE * 4; i += 1) {
      $.vec.pushBack(v, `Element #${i}`);
   }
   $.vec.freeze(v);

   let w = $.vec.newIdentity(v);

   for (let i = 0; i < $.vec.MAX_NODE_SIZE; i += 1) {
      $.vec.pushBack(w, `New Element #${i}`);
   }
   $.vec.freeze(w);

   console.log(v);
   console.log(w);
}
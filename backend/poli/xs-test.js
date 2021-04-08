bootstrap
   assert
trie
   * as: trie
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
`.slice(1)
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
perfTrie ::= function (N) {
   let map = $.Trie(([key]) => key);
   
   let M = $.allKeys.length;
   for (let i = 0; i < M; i += 1) {
      map = $.trieAdd(map, [$.allKeys[i], $.allValues[i]]);
   }
   
   console.time();
   for (let i = 0; i < N; i += 1) {
      let ikey = Math.floor(Math.random() * M);
      let ival = Math.floor(Math.random() * M);
      map = $.trieAdd(map, [$.allKeys[ikey], $.allValues[ival]]);
      
      let s = $.trieSearch(map, $.allKeys[Math.floor(Math.random() * M)]);
      if (s[0] === 'a') {
         console.log(s);
      }

   }
   console.timeEnd();
}
testTrie ::= function () {
   let t = $.trie.Trie((k1, [k2]) => k1 < k2 ? -1 : k1 > k2 ? 1 : 0);
   
   $.trie.addItem(t, ['england', 'angleterre'], 'england');
   $.trie.addItem(t, ['germany', 'allemagne'], 'germany');
   $.trie.addItem(t, ['russia', 'russie'], 'russia');
   $.trie.addItem(t, ['spain', 'espagne'], 'spain');
   
   console.log(Array.from($.trie.items(t)));
   
   let deleted = $.trie.deleteByKey(t, 'germany');
   $.assert(deleted === true);

   deleted = $.trie.deleteByKey(t, 'germany');
   $.assert(deleted === false);

   console.log(Array.from($.trie.items(t)));

   return;
}

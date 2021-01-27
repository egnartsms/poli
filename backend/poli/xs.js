xs-reader
   makeStream
-----
assert ::= $_.require('assert').strict
sample ::= `
: a b c
  . d
`
reString ::= /"(?:\\?.)*?"/y
reWord ::= /[a-zA-Z0-9~!@$%^&*-_+=?/<>.:]+/y
readString ::= function (str) {
   let i = 0;
   
   if (str[i] === '"') {
      let mo = $.execAt($.reString, i, str);
      if (mo === null) {
         throw new Error("Invalid string");
      }
      return {
         type: 'string',
         value: JSON.parse(mo[0])
      }
   }
   else
      throw new Error("Not a string");
   
}
readWord ::= function (str) {
   let i = 0;

   let mo = $.execAt($.reWord, i, str);
   if (mo === null) {
      throw new Error("Invalid");
   }
   return {
      type: 'id',
      name: mo[0]
   }
}
execAt ::= function (re, i, str) {
   $.assert(re.sticky);
   re.lastIndex = i;
   return re.exec(str);
}
read ::= function (str) {
   let toplevels = [];
   let stack = [{
      indent: -1,
      sub: toplevels
   }];
   let top = stack[stack.length - 1];

   function pushFrame(frame) {
      stack.push(frame);
      top = frame;
   }

   function popFrame() {
      $.assert(stack.length > 0);
      stack.pop();
      top = stack[stack.length - 1];
   }

   function popToIndent(indent) {
      let n = stack.length - 1;
      while (stack[n].indent >= indent) {
         n -= 1;
      }
      stack.splice(n + 1, stack.length);
      top = stack[stack.length - 1];
   }

   function readStream1(stream) {
      let atom = $.consumeAtom(stream);
      if (atom === null) {
         return false;
      }

      if (atom.type === 'str') {
         top.sub.push({
            type: 'str',
            str: atom.str
         })
      }
      else if (atom.type === '(') {
         let compound = {
            type: 'compound',
            head: null,  // to be filled later
            tail: [],
         };

         top.sub.push();
         pushFrame({
            indent: null,
            sub: newsub
         });
      }
      else if (atom.paren === ')') {
         if (top.indent !== null) {
            throw new Error(`Unbalanced parentheses in: ${stream.str}`)
         }
         popFrame();
      }

      return true;
   }

   function readStreamAll(stream) {
      for (;;) {
         let atom = $.consumeAtom(stream, reAtom);
         if (atom === null) {
            break;
         }

         if (atom.type === 'str') {
            top.sub.push({
               type: 'str',
               str: atom.str
            })
         }
         else if (atom.type === '(') {
            let newsub = [];
            top.sub.push({
               type: 'compound',
               sub: newsub
            });
            pushFrame({
               indent: null,
               sub: newsub
            });
         }
         else if (atom.paren === ')') {
            if (top.indent !== null) {
               throw new Error(`Unbalanced parentheses in: ${stream.str}`)
            }
            popFrame();
         }
         else if (atom.type === ':(') {
            throw new Error(`Not implemented`);
         }
         else if (atom.type === 'word') {
            topsub.push({
               id: atom.unit
            });
         }
         else {
            throw new Error(`Logic error: unrecognized atom type: ${atom.type}`);
         }
      }

      if (stack[stack.length - 1].indent === null) {
         throw new Error(`Unbalanced parentheses in the line: ${stream.str}`);
      }
   }

   let stream = $.makeStream(str);


   for (;;) {
      let indent = $.peekIndentation(stream);
      if (indent === 0) {}
   }

   for (let line of str.split(/\n/)) {
      let indent = $.indentationOf(line);

      if (indent === line.length) {
         if (top.isComment) {
            top.lines.push('\n');
         }
         else {
            top.sub.push({
               type: 'nl'
            })
         }
         continue;
      }

      popToIndent(indent);

      // let stream = $.makeStream(line, indent);

      if (line[indent] === ';') {
         if (line[indent + 1] !== ' ') {
            throw new Error(`Comment must start with ; followed by a space`);
         }

         pushFrame({
            indent,
            isComment: true,
            lines: [
               line.slice(indent + 2)
            ]
         });
      }
      else if (line[indent] === '\\') {
         if (line[indent + 1] !== ' ') {
            throw new Error(`Continuation line must start with \\ followed by a space`);
         }
         readStream($.makeStream(line, indent + 2));
      }
      else {
         pushFrame({
            indent,
            sub: []
         });
         readLine();
      }
   }

   return toplevels;
}
peekIndentation ::= function (stream) {
   const re = /[ ]*/y;
   re.lastIndex = stream.pos;
   return re.exec(stream.str)[0].length;
}
lookingAt ::= function (stream, re) {
   $.assert(re.sticky);
   re.lastIndex = stream.i;
   return re.test(stream.str);
}
indentationOf ::= function (str) {
   let mo = /^[ ]*/.exec(str);
   return mo[0].length;
}
consume ::= function (stream, re) {
   $.assert(re.sticky);

   re.lastIndex = stream.i;
   stream.match = re.exec(stream.str);

   if (stream.match !== null) {
      stream.i += stream.nconsumed;
   }

   return stream.match !== null;
}
consumeAtom ::= function (stream) {
   $.consume(stream, /[ ]+/y);

   if (stream.isExhausted) {
      return null;
   }
   
   if ($.consume(stream, /:?\(|\)/y)) {
      return {
         type: stream.match[0]
      }
   }
   
   if ($.consume(stream, $.reWord)) {
      if (!$.lookingAt(stream, /[ ]|$/y)) {
         throw new Error(`Invalid characters encountered as part of a word`);
      }
      return {
         type: 'word',
         word: stream.match[0]
      }
   }
   
   if ($.consume(stream, $.reString)) {
      return {
         type: 'str',
         str: JSON.parse(stream.match[0])
      }
   }
   
   throw new Error(`Invalid character at: "${stream.str.slice(stream.i)}"`);
}
test ::= function () {
   $.test_normal();
   $.test_overbalanced();
   $.test_underbalanced();
   $.test_colon();
   $.test_colonAndDot();
   $.test_dotAfterColon();
   $.test_dotAfterDot();
   $.test_dotNotFirst();
   $.test_colonNotFirst();
}
test_normal ::= function () {
   let s = `
      if (! x)
         do-1
      else
         do-2
   `;
   $.assert.deepEqual($.read(s), [
      {
         nl: true,
         sub: [
            {id: 'if'},
            {sub: [{id: '!'}, {id: 'x'}]},
            {nl: true, sub: [{id: 'do-1'}]}
         ]
      },
      {
         nl: true,
         sub: [
            {id: 'else'},
            {nl: true, sub: [{id: 'do-2'}]}
         ]
      }
   ]);
}
test_overbalanced ::= function () {
   let s = `
      if (() a
         do-1
   `;
   $.assert.throws(() => $.read(s));
}
test_underbalanced ::= function () {
   let s = `
      if )(a)
   `;
   $.assert.throws(() => $.read(s));
}
test_colon ::= function () {
   let s = `
      : : a
        b c
        . d
   `;
   $.assert.deepEqual($.read(s), [
      {
         nl: true,
         sub: [
            {
               nl: true,
               sub: [
                  {
                     nl: true,
                     sub: [{id: 'a'}]
                  }
               ]
            },
            {
               nl: true,
               sub: [{id: 'b'}, {id: 'c'}]
            },
            {id: 'd'}
         ]
      }
   ]);
}
test_colonAndDot ::= function () {
   let s = `
      :
         . a
   `;
   $.assert.deepEqual($.read(s), [
      {
         nl: true,
         sub: [
            {id: 'a'}
         ]
      }
   ]);   
}
test_dotAfterColon ::= function () {
   let s = `
      : . a
   `;
   $.assert.throws(() => $.read(s));
}
test_dotAfterDot ::= function () {
   let s = `
      . . x
   `;
   $.assert.throws(() => $.read(s));
}
test_dotNotFirst ::= function () {
   let s = `
      hey . x
   `;

   $.assert.throws(() => $.read(s));
}
test_colonNotFirst ::= function () {
      let s = `
      y : x
   `;
   $.assert.throws(() => $.read(s));
}

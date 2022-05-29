exp
   combox
xs-reader
   ReaderError
xs-tokenizer
   TokenizerError
-----

ApiError ::=
   class extends Error {
      constructor (error, message, info) {
         super(message);

         this.error = error;
         this.info = info;
      }
   }

genericError ::=
   function (message) {
      return new $.ApiError('generic', message, {});
   }

rethrowCodeErrorsOn ::=
   function (source, callback) {
      try {
         return callback();
      }
      catch (e) {
         if (e instanceof $.ReaderError && e.str === source ||
               e instanceof $.TokenizerError && e.str === source) {
            throw new $.ApiError('code', {
               message: e.message,
               row: e.row,
               col: e.col,
            });
         }
         else {
            throw e;
         }
      }
   }

detour ::=
   function () {
      return 'fuck';
   }

callHer ::=
   function () {
      let v = $.vec.Vector(['a', 'b', 'c']);
      return $.vec.at(v, 2);
   }

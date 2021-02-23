xs-reader
   ReaderError
xs-tokenizer
   TokenizerError
-----
ApiError ::= class extends Error {
   constructor (error, info) {
      super();
      this.error = error;
      this.info = info;
   }
}
rethrowCodeErrorsOn ::= function (source, callback) {
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

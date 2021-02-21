-----
ApiError ::= class extends Error {
   constructor (error, info) {
      super();
      this.error = error;
      this.info = info;
   }
}
throwApiError ::= function (error, info) {
   throw new $.ApiError(error, info);
}

module.exports = {
   WebSocket: `require('ws')`,
   port: `8080`,
   server: `null`,
   ws: `null`,
   _init: `function () {
      $.server = new $.WebSocket.Server({port: $.port});
      $.server
         .on('error', function (error) {
            console.error("WebSocket server error:", error);
         })
         .on('connection', function (ws) {
            if ($.ws !== null) {
               console.error("Double simultaneous connections attempted");
               ws.close();
               return;
            }

            $.ws = ws;
            $.ws
               .on('message', function (data) {
                  $.handleOperation(data);
               })
               .on('close', function (code, reason) {
                  $.ws = null;
                  console.log("Front-end disconnected. Code:", code, "reason:", reason);
               })
               .on('error', function (error) {
                  console.error("WebSocket client connection error:", error);
               });
         });
   }`,
   handleOperation: `function (data) {
      console.log("Attempted operation: ", data);
   }`,
   opHandlers: `{
      getProjects: function () {
         $.opReturn(
            Object.values($.projects).map(proj => ({
               id: proj.id,
               name: proj.name,
               path: proj.path
            }))
         );
      },
   }`
};

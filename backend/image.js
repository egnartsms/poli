const {recreateImage, runImage, dumpImage, compactImage} = require('./script/op');


const HELP_TEXT = `
Use it like this:

   * node image create
      
      Create a fresh image ./poli.image from the contents of the ./poli subfolder.
      This is the inverse of "dump".

   * node image dump

      Dump the contents of ./poli.image into the ./poli subfolder. The latter is
      completely re-generated. This is the inverse of "create".

   * node image compact

      Collect garbage in the image, then re-identify objects to use sequential IDs,
      then VACUUM the image.

   * node image run

      Run the Poli backend WebSocket server using the current ./poli.image.
`;


function main() {
   if (process.argv.length <= 2) {
      console.log(HELP_TEXT);
      process.exit(1);
   }

   let cmd = process.argv[2];

   switch (cmd) {
      case 'create':
         recreateImage();
      break;

      case 'dump':
         dumpImage();
      break;

      case 'run':
         runImage();
      break;

      case 'compact':
         compactImage();
      break;

      case 'help':
      default:
         console.log(HELP_TEXT);
   }
}


if (require.main === module) {
   main();
}

// Backward-compatible command name: use the same protected interactive setup.
const { main } = require('./scripts/setupAdmin');
if (require.main === module) main();
module.exports = main;

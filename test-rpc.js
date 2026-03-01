// test-rpc.js
const { execSync } = require('child_process');

try {
    execSync('npx ts-node -e "import { fetchTokenData } from \'./src/lib/dataService\'; fetchTokenData(\'JUPyiwrYPRnK3B9kR4A9p7YQ8vLwK2qNCjY7MkW99Ld\').then(console.log).catch(console.error);"');
    console.log("TEST SUCCESSFUL");
} catch (e) {
    console.error("TEST FAILED", e.message);
}

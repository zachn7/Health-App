const fs = require('fs'); const index = fs.readFileSync('dist/index.html', 'utf8'); console.log(index.includes('href=\"#/legal')); "  

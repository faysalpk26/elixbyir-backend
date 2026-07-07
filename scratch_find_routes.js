const fs = require('fs');
const path = require('path');

const routesDir = 'c:\\Users\\PMLS\\Desktop\\pinkdreams-backend-main\\pinkdreams-backend-main\\routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const authKeywords = [
  'verifyStaffUsersToken',
  'requirePermission',
  'authenticate',
  'ensureAuthenticated',
  'passport',
  'requireAuth',
  'verifyToken'
];

console.log('--- Public Endpoints ---');

files.forEach(file => {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
  
  // A regex to capture router.something(...) block
  // It handles nested parentheses to some extent by matching up to the last closing parenthesis before a semicolon
  const routeRegex = /router\.(get|post|put|patch|delete)\s*\(([\s\S]*?)\);/g;
  
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const argsBlock = match[2];
    
    // Find the first argument which is the path
    const pathMatch = argsBlock.match(/^\s*(["'`])(.*?)\1/);
    if (!pathMatch) continue;
    const routePath = pathMatch[2];
    
    // Check if the block contains any auth keyword
    const isProtected = authKeywords.some(kw => argsBlock.includes(kw));
    
    if (!isProtected) {
      console.log(`${file}: ${method} ${routePath}`);
    }
  }
});

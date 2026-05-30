const fs = require('fs');
const path = require('path');

const dest = path.join(__dirname, 'www');

// Create the www folder if it doesn't exist
if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest);
}

// Automatically find all web files in the root directory
const filesToCopy = fs.readdirSync(__dirname).filter(file => {
  const ext = path.extname(file).toLowerCase();
  const isWebFile = ['.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg'].includes(ext);
  const isServerFile = ['server.js', 'copy-assets.js', 'package.json', 'package-lock.json'].includes(file);
  return isWebFile && !isServerFile;
});

filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  if (fs.existsSync(src) && fs.statSync(src).isFile()) {
    fs.copyFileSync(src, path.join(dest, file));
  }
});

console.log('✅ All web files successfully copied to the "www" folder!');
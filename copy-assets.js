const fs = require('fs');
const path = require('path');

const dest = path.join(__dirname, 'www');

// Create the www folder if it doesn't exist
if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest);
}

// List of all your frontend web files
const filesToCopy = [
  'index.html', 'emergency.html', 'user.html', 'share.html', 'blood.html', 'hospital.html', 'schemes.html', 'driver.html', 'track.html',
  'style.css', 'modern-style.css',
  'script.js', 'modern-script.js', 'sw.js',
  'manifest.json', 'logo.svg'
];

filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(dest, file));
  }
});

console.log('✅ All web files successfully copied to the "www" folder!');
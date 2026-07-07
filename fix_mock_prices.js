const fs = require('fs');
const path = require('path');

const filesToFix = [
  path.join(__dirname, 'mock-allproducts.json'),
  path.join(__dirname, '../../New folder/parksofideas/parksofideas/public/assets/mock-allproducts.json')
];

filesToFix.forEach(file => {
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.products.forEach(p => {
      if (p.id === 5) {
        // Keep a 10% discount for product ID 5 (AURA CRYSTAL)
        p.old_price = Math.round(p.new_price / 0.9); 
      } else {
        // Remove discount for all others
        p.old_price = p.new_price;
      }
    });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log('Fixed', file);
  } else {
    console.log('Not found:', file);
  }
});

const fs = require('fs');
const csv = require('csv-parser');

const filename = 'vet.csv';
const jsonData = [];

fs.createReadStream(filename)
  .pipe(csv())
  .on('data', (row) => {
    jsonData.push(row);
  })
  .on('end', () => {
    console.log('CSV file successfully processed');

    const jsonFilename = 'vet.json';
    fs.writeFileSync(jsonFilename, JSON.stringify(jsonData, null, 2));
    console.log(`JSON data saved to ${jsonFilename}`);
  });

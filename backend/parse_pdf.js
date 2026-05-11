const fs = require('fs');
const pdf = require('pdf-parse');
let dataBuffer = fs.readFileSync('C:/Users/suvam/Desktop/VS code/Projects/FixFlowAI/reference/Generate a $10,000 Website with Just One Line of Code.pdf');
pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(console.error);

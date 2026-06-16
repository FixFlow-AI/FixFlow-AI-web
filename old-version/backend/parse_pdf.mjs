import fs from 'fs';
import pdf from 'pdf-parse';

let dataBuffer = fs.readFileSync('C:/Users/suvam/Desktop/VS code/Projects/FixFlowAI/reference/Generate a $10,000 Website with Just One Line of Code.pdf');

try {
  let parsed = await pdf(dataBuffer);
  console.log(parsed.text);
} catch (e) {
  // if pdf-parse exported as default inside an object
  if (pdf && pdf.default) {
    let parsed = await pdf.default(dataBuffer);
    console.log(parsed.text);
  } else {
    console.log("pdf is", pdf);
    console.error(e);
  }
}

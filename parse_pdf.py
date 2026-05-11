import PyPDF2
import re
import json

def extract_pdf_info(filepath):
    text_content = []
    urls = set()
    with open(filepath, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            text_content.append(page.extract_text())
            if '/Annots' in page:
                annots = page['/Annots']
                if annots:
                    for annot in annots:
                        try:
                            obj = annot.get_object()
                            if '/A' in obj and '/URI' in obj['/A']:
                                urls.add(str(obj['/A']['/URI']))
                        except:
                            pass
                            
    text_str = '\n'.join(text_content)
    url_pattern = re.compile(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+')
    text_urls = url_pattern.findall(text_str)
    for u in text_urls:
        urls.add(u)
        
    out = {
        "urls": list(urls),
        "text": text_str[:2000]
    }
    
    with open('pdf_out.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    extract_pdf_info("reference/guide.pdf")

import sys
try:
    import pypdf
    reader = pypdf.PdfReader('PFE_IT_Support.pdf')
    with open('PFE_IT_Support_text.txt', 'w', encoding='utf-8') as f:
        for page in reader.pages:
            f.write(page.extract_text() + '\n')
    print("Success")
except Exception as e:
    print('Error:', e)

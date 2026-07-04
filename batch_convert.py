#!/usr/bin/env python3
"""Batch RTF to ePUB Converter - Processes all RTF files and updates catalog"""

import os
import re
import json
import subprocess
from pathlib import Path

def extract_metadata_from_filename(filename):
    """Extract title, author, year from: Title=[...] Author=[...] Year=[YYYY].rtf"""
    name = filename.replace('.rtf', '')
    title_match = re.search(r'Title=\[(.*?)\]', name)
    author_match = re.search(r'Author=\[(.*?)\]', name)
    year_match = re.search(r'Year=\[(\d{4})\]', name)
    
    title = title_match.group(1) if title_match else name
    author = author_match.group(1) if author_match else "Unknown"
    year = year_match.group(1) if year_match else "Unknown"
    
    base_name = re.sub(r'[^\w\s-]', '', title.lower())
    base_name = re.sub(r'[-\s]+', '-', base_name) + f"-{year}"
    
    return title, author, year, base_name

def load_catalog(path='data.js'):
    """Load existing catalog from data.js"""
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    match = re.search(r'const\s+archiveData\s*=\s*(\[.*?\]);', content, re.DOTALL)
    return json.loads(match.group(1)) if match else []

def save_catalog(books, path='data.js'):
    """Save catalog to data.js"""
    books_sorted = sorted(books, key=lambda x: (-int(x['y']) if x['y'].isdigit() else 0, x['t']))
    js = "const archiveData = " + json.dumps(books_sorted, indent=2) + ";\n"
    with open(path, 'w', encoding='utf-8') as f:
        f.write(js)
    print(f"✅ Catalog updated: {len(books)} books")

def batch_convert(books_dir='books'):
    """Convert all RTF files and update catalog"""
    rtf_files = list(Path(books_dir).glob('*.rtf'))
    if not rtf_files:
        print("No RTF files found")
        return
    
    print(f"\n📚 Found {len(rtf_files)} RTF files\n")
    books = load_catalog()
    existing = {b['base'] for b in books}
    converted = 0
    
    for rtf_path in rtf_files:
        print(f"Processing: {rtf_path.name}")
        title, author, year, base = extract_metadata_from_filename(rtf_path.name)
        
        if base in existing:
            print(f"⏭️  Skipped (already in catalog)\n")
            continue
        
        epub_path = os.path.join(books_dir, f"{base}.epub")
        result = subprocess.run([
            'python3', 'convert_rtf_to_epub.py',
            str(rtf_path), epub_path, title, author, year
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            books.append({"t": title, "a": author, "y": year, "base": base, "epub": True, "rtf": True})
            converted += 1
        else:
            print(f"❌ Failed: {result.stderr}\n")
    
    if converted > 0:
        save_catalog(books)
        print(f"\n✅ Converted {converted} books")

if __name__ == "__main__":
    if not os.path.exists('convert_rtf_to_epub.py'):
        print("❌ Error: convert_rtf_to_epub.py not found")
        exit(1)
    batch_convert()

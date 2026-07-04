#!/usr/bin/env python3
"""
Universal RTF to ePUB Converter with Proper Table of Contents
Works on any platform (Windows, Mac, Linux)
Requires: Calibre to be installed

Usage:
    python convert_rtf_to_epub.py "input.rtf" "output.epub" "Book Title" "Author Name" "2024"
"""

import os
import sys
import subprocess
import tempfile
import zipfile
import shutil
from pathlib import Path

def convert_rtf_to_epub(rtf_file, output_epub, title, author, year):
    """
    Convert RTF to ePUB with proper table of contents
    
    Args:
        rtf_file: Path to input RTF file
        output_epub: Path to output ePUB file
        title: Book title
        author: Book author
        year: Publication year
    """
    
    print(f"\n📚 Converting: {title}")
    print(f"   Author: {author}")
    print(f"   Year: {year}")
    print(f"   Input: {rtf_file}")
    print(f"   Output: {output_epub}\n")
    
    # Check if Calibre is installed
    try:
        subprocess.run(["ebook-convert", "--version"], 
                      capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ Error: Calibre is not installed or ebook-convert is not in PATH")
        print("   Install from: https://calibre-ebook.com/download")
        sys.exit(1)
    
    # Create temporary directory for intermediate files
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_epub = os.path.join(temp_dir, "temp.epub")
        
        # Calibre conversion with TOC-friendly settings
        calibre_cmd = [
            "ebook-convert",
            rtf_file,
            temp_epub,
            
            # Metadata
            "--title", title,
            "--authors", author,
            "--pubdate", year,
            
            # TOC Generation - KEY FIX FOR THE PROBLEM
            "--chapter", "//h:h1",           # Detect h1 as chapter
            "--chapter", "//h:h2",           # Detect h2 as chapter
            "--level1-toc", "//h:h1",        # Use h1 for TOC level 1
            "--level2-toc", "//h:h2",        # Use h2 for TOC level 2
            "--level3-toc", "//h:h3",        # Use h3 for TOC level 3
            
            # Page breaks
            "--page-breaks-before", "//*[name()='h1' or name()='h2']",
            
            # Heuristics for better structure detection
            "--enable-heuristics",
            "--insert-blank-line",
            "--remove-paragraph-spacing",
            "--linearize-tables",
            
            # Preserve structure
            "--preserve-cover-aspect-ratio",
            "--no-default-epub-cover",
        ]
        
        print("⚙️  Running Calibre conversion...")
        try:
            result = subprocess.run(calibre_cmd, capture_output=True, text=True, check=True)
            print("✅ Calibre conversion completed")
        except subprocess.CalledProcessError as e:
            print(f"❌ Calibre conversion failed:")
            print(f"   {e.stderr}")
            sys.exit(1)
        
        # Add custom front page
        print("⚙️  Adding front page...")
        add_front_page(temp_epub, output_epub, title, author, year)
        
        print(f"✅ ePUB created successfully: {output_epub}\n")
        return True


def add_front_page(input_epub, output_epub, title, author, year):
    """
    Extract ePUB, add custom front page, and repackage
    """
    with tempfile.TemporaryDirectory() as extract_dir:
        # Extract ePUB (it's a ZIP file)
        with zipfile.ZipFile(input_epub, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        # Create front page HTML
        front_page_html = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <title>{escape_html(title)}</title>
    <style>
        body {{
            text-align: center;
            padding: 20%;
            font-family: serif;
            margin: 0;
        }}
        h1 {{
            font-size: 2.5em;
            margin-bottom: 1em;
            font-weight: bold;
        }}
        .author {{
            font-size: 1.5em;
            margin-bottom: 0.5em;
            font-style: italic;
        }}
        .year {{
            font-size: 1.2em;
            color: #666;
        }}
        hr {{
            width: 50%;
            margin: 2em auto;
        }}
    </style>
</head>
<body>
    <h1>{escape_html(title)}</h1>
    <hr/>
    <p class="author">by {escape_html(author)}</p>
    <p class="year">{escape_html(year)}</p>
</body>
</html>
"""
        
        # Find the OEBPS or content directory
        content_dir = None
        for root, dirs, files in os.walk(extract_dir):
            if 'content.opf' in files:
                content_dir = root
                break
        
        if content_dir:
            # Write front page
            front_page_path = os.path.join(content_dir, 'titlepage.xhtml')
            with open(front_page_path, 'w', encoding='utf-8') as f:
                f.write(front_page_html)
            
            # Update content.opf to include front page
            update_content_opf(os.path.join(content_dir, 'content.opf'))
        
        # Repackage as ePUB
        create_epub(extract_dir, output_epub)


def update_content_opf(opf_path):
    """
    Update the content.opf file to include front page in manifest and spine
    """
    try:
        with open(opf_path, 'r', encoding='utf-8') as f:
            opf_content = f.read()
        
        # Add titlepage to manifest if not already present
        if 'titlepage.xhtml' not in opf_content and 'id="titlepage"' not in opf_content:
            # Find the end of manifest tag
            manifest_end = opf_content.find('</manifest>')
            if manifest_end != -1:
                manifest_item = '  <item href="titlepage.xhtml" id="titlepage" media-type="application/xhtml+xml"/>\n  '
                opf_content = opf_content[:manifest_end] + manifest_item + opf_content[manifest_end:]
        
        # Add titlepage to spine at the beginning if not already present
        if '<spine' in opf_content and 'idref="titlepage"' not in opf_content:
            # Find the spine opening tag and add itemref after it
            spine_start = opf_content.find('<spine')
            if spine_start != -1:
                spine_start = opf_content.find('>', spine_start) + 1
                spine_item = '\n    <itemref idref="titlepage"/>'
                opf_content = opf_content[:spine_start] + spine_item + opf_content[spine_start:]
        
        with open(opf_path, 'w', encoding='utf-8') as f:
            f.write(opf_content)
            
    except Exception as e:
        print(f"⚠️  Warning: Could not update content.opf: {e}")


def create_epub(source_dir, output_file):
    """
    Create ePUB file from directory
    ePUB specification requires mimetype to be first file and uncompressed
    """
    with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as epub:
        # mimetype MUST be first and uncompressed per ePUB spec
        mimetype_path = os.path.join(source_dir, 'mimetype')
        if os.path.exists(mimetype_path):
            epub.write(mimetype_path, 'mimetype', compress_type=zipfile.ZIP_STORED)
        
        # Add META-INF directory
        meta_inf = os.path.join(source_dir, 'META-INF')
        if os.path.exists(meta_inf):
            for root, dirs, files in os.walk(meta_inf):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, source_dir)
                    epub.write(file_path, arcname)
        
        # Add all other files
        for root, dirs, files in os.walk(source_dir):
            # Skip META-INF (already added) and hidden directories
            if 'META-INF' in root or '/.git' in root:
                continue
                
            for file in files:
                if file == 'mimetype':  # Already added
                    continue
                    
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                epub.write(file_path, arcname)


def escape_html(text):
    """Basic HTML escaping"""
    return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;'))


if __name__ == "__main__":
    if len(sys.argv) != 6:
        print("Usage: python convert_rtf_to_epub.py <input.rtf> <output.epub> <title> <author> <year>")
        print("\nExample:")
        print('  python convert_rtf_to_epub.py "mybook.rtf" "mybook.epub" "The Great Story" "John Doe" "2024"')
        sys.exit(1)
    
    rtf_file = sys.argv[1]
    output_epub = sys.argv[2]
    title = sys.argv[3]
    author = sys.argv[4]
    year = sys.argv[5]
    
    if not os.path.exists(rtf_file):
        print(f"❌ Error: Input file not found: {rtf_file}")
        sys.exit(1)
    
    convert_rtf_to_epub(rtf_file, output_epub, title, author, year)

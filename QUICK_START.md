# 🚀 Quick Setup Guide for Non-Technical Users

## Choose Your Path

### Path A: Use GitHub Pages (Easiest - No Coding)
**Time: 5 minutes**

1. Create a GitHub account at https://github.com
2. Click "Fork" on this repository (top-right button)
3. Go to your forked repo → Settings → Pages
4. Under "Source", select "main" branch and "/" (root)
5. Click Save
6. Wait 2-3 minutes
7. Your site is live at `https://YOUR-USERNAME.github.io/REPO-NAME`

**Adding books:**
- Click "Add file" → "Upload files"
- Drag your RTF files (named correctly)
- Commit changes
- GitHub automatically converts them!

---

### Path B: Use Netlify (Free, Drag & Drop)
**Time: 3 minutes**

1. Download this repository as ZIP
2. Go to https://netlify.com and sign up
3. Drag the unzipped folder onto Netlify
4. Done! You get a URL like `https://your-site.netlify.app`

**Adding books:**
- Convert RTF to ePUB on your computer (see below)
- Update via Netlify's web interface or re-upload

---

### Path C: Your Own Website
**Time: 10 minutes**

1. Download this repository as ZIP
2. Unzip the folder
3. Log into your web host (cPanel, FTP, etc.)
4. Upload all files to your `public_html` folder
5. Visit your domain

**Adding books:**
- Convert RTF to ePUB on your computer
- Upload via FTP/cPanel to the `books/` folder
- Edit `data.js` to add the book entry

---

## Converting RTF to ePUB (For Paths B & C)

### Step 1: Install Calibre

**Windows:**
1. Go to https://calibre-ebook.com/download
2. Download and run the installer
3. Follow the wizard

**Mac:**
1. Go to https://calibre-ebook.com/download
2. Download the DMG file
3. Drag Calibre to Applications

**Linux:**
```bash
sudo apt-get install calibre
```

### Step 2: Install Python (if not already installed)

**Windows:**
1. Go to https://python.org/downloads
2. Download and run installer
3. ⚠️ Check "Add Python to PATH"!

**Mac:**
- Already installed, or use: `brew install python3`

**Linux:**
```bash
sudo apt-get install python3
```

### Step 3: Convert Your Books

**Prepare your RTF file:**
- Name it: `Title=[Book Title] Author=[Author Name] Year=[2024].rtf`
- Example: `Title=[Alice in Wonderland] Author=[Lewis Carroll] Year=[1865].rtf`

**Convert:**

**Windows (Command Prompt):**
```batch
cd C:\path\to\archive
python convert_rtf_to_epub.py "book.rtf" "books\output.epub" "Title" "Author" "2024"
```

**Mac/Linux (Terminal):**
```bash
cd /path/to/archive
python3 convert_rtf_to_epub.py "book.rtf" "books/output.epub" "Title" "Author" "2024"
```

**Convert ALL RTF files at once:**
```bash
python3 batch_convert.py
```

---

## Making Sure TOC Works

### The Problem
When you convert RTF to ePUB, sometimes the table of contents doesn't work properly. Links go nowhere.

### The Solution
Before exporting to RTF, **use proper heading styles** in your document:

**In Microsoft Word:**
1. Select chapter titles
2. Go to "Home" tab
3. Click "Heading 1" style
4. For sections, use "Heading 2"
5. For subsections, use "Heading 3"

**In Google Docs:**
1. Select chapter titles
2. Use the style dropdown (says "Normal text")
3. Choose "Heading 1" for chapters
4. "Heading 2" for sections
5. "Heading 3" for subsections

**In LibreOffice:**
1. Select text
2. Use the style dropdown in toolbar
3. Choose "Heading 1", "Heading 2", etc.

### Example Structure:
```
Heading 1: Chapter 1: The Beginning
  Heading 2: Section 1.1: First Scene
    Heading 3: Part A
    Heading 3: Part B
  Heading 2: Section 1.2: Second Scene

Heading 1: Chapter 2: The Middle
  Heading 2: Section 2.1: Conflict
```

**Then export as RTF and convert!**

---

## Editing Your Archive

### Change the Site Name
Open `index.html` in a text editor:
- Line 6: `<title>Your Archive Name</title>`
- Line 99: `<h1>Your Archive Name</h1>`

### Add a Book Manually (Without RTF)
If you already have an ePUB file:

1. Put it in the `books/` folder
2. Open `data.js` in a text editor
3. Add a new entry:
```javascript
{
  "t": "The Book Title",
  "a": "Author Name",
  "y": "2024",
  "base": "filename-without-epub-extension",
  "epub": true,
  "rtf": false
}
```
4. Save and upload

### Change Colors
Open `css/themes.css` and edit the existing themes or add new ones!

---

## Troubleshooting

### "Command not found"
- Make sure you installed Calibre and Python
- On Windows, ensure "Add to PATH" was checked during install
- Restart your terminal/command prompt

### "Books don't appear"
- Check `data.js` for typos (use jsonlint.com to validate)
- Make sure file paths are correct
- Clear your browser cache (Ctrl+Shift+R)

### "TOC still broken"
- Go back to your original Word doc
- Apply Heading 1, Heading 2 styles properly
- Re-export as RTF
- Convert again

### "Can't open HTML file locally"
You need a local server. Easiest way:
```bash
cd /path/to/archive
python3 -m http.server 8000
```
Then open: http://localhost:8000

---

## Video Tutorials (If Available)

*Coming soon: Video walkthroughs for each platform*

---

## Need More Help?

1. Read the full README.md
2. Check existing GitHub issues
3. Open a new issue with:
   - What you're trying to do
   - What's happening
   - Screenshots if possible

---

## Pro Tips

### Batch Process Many Books
Put all your RTF files in the `books/` folder, then:
```bash
python3 batch_convert.py
```
It converts everything and updates data.js automatically!

### Keep Originals
Always keep your original Word/RTF files. The ePUB conversion might need tweaking.

### Test Locally First
Before uploading to your website, test everything on your computer using:
```bash
python3 -m http.server 8000
```

### Backup Your Work
Keep a backup of your `data.js` file before making changes!

---

**You've got this! 🎉**

If you get stuck, remember: thousands of people have successfully set this up. You can too!

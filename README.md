# 📚 Universal Book Archive

A digital library archive for classic public domain literature that works **anywhere** - GitHub Pages, your own website, or any web server. This open-source project provides a searchable, filterable interface with built-in EPUB reading capabilities.

## ✨ Features

- **📖 Searchable catalog** by title, author, and publication year
- **📱 Built-in EPUB reader** for reading books directly in the browser
- **⬇️ Download mode** for bulk downloading books  
- **🎨 Multiple themes** (light/dark modes)
- **🔤 Customizable fonts** for comfortable reading
- **🌐 Platform-agnostic** - works on any web server
- **⚙️ Easy book management** with automated conversion scripts

---

## 🚀 Quick Start Guide

### Option 1: Deploy on GitHub Pages (Easiest)
1. Fork this repository
2. Go to Settings → Pages
3. Set Source: "Deploy from a branch" → `main` → `/ (root)`
4. Your site will be live at `https://yourusername.github.io/repository-name`

### Option 2: Deploy on Your Own Website
1. Download this repository as ZIP
2. Extract all files
3. Upload to your web server's public directory (e.g., `public_html`)
4. Access via your domain (e.g., `https://yourdomain.com`)

### Option 3: Deploy on Free Static Hosting
Works with Netlify, Vercel, Cloudflare Pages, or any static host:
1. Download this repository
2. Drag and drop the folder onto your hosting platform
3. Done! Your site is live

---

## 📖 Adding Books

### Method 1: Automated RTF Conversion (Recommended)

**Step 1:** Export your book as **Rich Text Format (.rtf)** from Word, Google Docs, or any word processor

**Step 2:** Name the file with metadata tags:
```
Title=[Your Book Title] Author=[Author Name] Year=[YYYY].rtf
```
Example: `Title=[The Three Little Pigs] Author=[Joseph Jacobs] Year=[1890].rtf`

**Step 3:** Convert to ePUB:

**On GitHub (automatic):**
- Upload the RTF to the `books/` folder
- Commit and push
- GitHub Actions will automatically convert it

**On Your Own Server (manual):**
```bash
# Install Calibre first (required for conversion)
# Linux: sudo apt-get install calibre
# Mac: brew install calibre
# Windows: Download from https://calibre-ebook.com/

# Convert single file
python3 convert_rtf_to_epub.py "path/to/book.rtf" "books/output.epub" "Title" "Author" "2024"

# Or convert all RTF files at once
python3 batch_convert.py
```

The conversion scripts automatically:
- ✅ Generate proper table of contents from headings
- ✅ Add custom front page with title/author/year
- ✅ Update the `data.js` catalog
- ✅ Fix TOC navigation issues

### Method 2: Add ePUB/PDF Files Directly

1. Add your `.epub` or `.pdf` files to the `books/` folder
2. Edit `data.js` and add an entry:
```javascript
{
  "t": "Book Title",
  "a": "Author Name", 
  "y": "2024",
  "base": "filename-without-extension",
  "epub": true,
  "rtf": false
}
```
3. Save and deploy

---

## 🛠️ Installation & Setup

### Requirements
- **For viewing**: Any modern web browser
- **For converting books**: Python 3 and Calibre

### Setting Up Conversion Tools

**Linux/Ubuntu:**
```bash
sudo apt-get update
sudo apt-get install calibre python3
```

**macOS:**
```bash
brew install calibre python3
```

**Windows:**
1. Install Python from https://python.org
2. Install Calibre from https://calibre-ebook.com
3. Add Calibre to your PATH

### Verify Installation
```bash
python3 --version
ebook-convert --version
```

---

## 📁 Repository Structure

```
fairytalesarchive/
├── books/                        # All book files (EPUB, PDF, RTF)
│   ├── book1.epub
│   ├── book2.pdf
│   └── book3.rtf
├── css/
│   └── themes.css                # Color themes
├── js/
│   ├── epub.min.js               # EPUB.js library
│   ├── index.js                  # Main library interface
│   ├── jszip.min.js              # ZIP handling
│   ├── reader.js                 # EPUB reader logic
│   └── themes.js                 # Theme switching
├── convert_rtf_to_epub.py        # ⭐ Single file converter
├── batch_convert.py              # ⭐ Batch converter for all RTFs
├── data.js                       # Book catalog
├── index.html                    # Main library page
├── reader.html                   # EPUB reader page
├── sw.js                         # Service worker (optional)
└── README.md                     # This file
```

---

## 🔧 Customization Guide

### Change Site Title
Edit `index.html`, line 6 and line 99:
```html
<title>Your Archive Name</title>
...
<h1>Your Archive Name</h1>
```

### Add New Color Themes
Edit `css/themes.css`:
```css
.theme-custom {
    --bg: #f5f5f5;
    --text: #333;
    --border: #999;
    --accent: #ccc;
    --hover-bg: #333;
    --hover-text: #fff;
}
```

Then add to `js/themes.js`:
```javascript
{name: "Custom Theme", class: "theme-custom"}
```

### Add Custom Fonts
Edit `index.html` around line 110-119:
```html
<option value="'Your Font', fallback">Font Name</option>
```

### Add a Logo
Add image file and modify `index.html`:
```html
<div class="header-top">
    <img src="logo.png" alt="Logo" style="height: 50px;">
    <h1>Digital Library Archive</h1>
</div>
```

---

## 🌐 Deployment Options

### Static Web Hosting Services (Free)

#### Netlify
1. Create account at https://netlify.com
2. Drag and drop your folder
3. Done! Auto-updates on git push (optional)

#### Vercel
1. Create account at https://vercel.com
2. Import from GitHub or upload files
3. Deploy with one click

#### Cloudflare Pages
1. Create account at https://pages.cloudflare.com
2. Connect to GitHub or upload files
3. Lightning-fast deployment

#### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Traditional Web Hosting

Works on any hosting provider (Bluehost, HostGator, GoDaddy, etc.):
1. Use FTP/cPanel File Manager
2. Upload all files to `public_html` or `www` directory
3. Access via your domain

### Self-Hosted (VPS/Server)

**Using nginx:**
```bash
# Install nginx
sudo apt-get install nginx

# Copy files
sudo cp -r /path/to/archive/* /var/www/html/

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**Using Apache:**
```bash
# Install Apache
sudo apt-get install apache2

# Copy files
sudo cp -r /path/to/archive/* /var/www/html/

# Start Apache
sudo systemctl start apache2
```

**Using Python (for testing):**
```bash
cd /path/to/archive
python3 -m http.server 8000
# Open http://localhost:8000
```

**Using Node.js:**
```bash
npx serve /path/to/archive
```

### Docker Deployment
Create `Dockerfile`:
```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t book-archive .
docker run -p 8080:80 book-archive
```

---

## 🎯 Troubleshooting

### ePUB Table of Contents Not Working

**Problem:** TOC links go to non-existent pages

**Solution:** This happens when RTF files lack proper heading structure. 

**Fix your RTF files:**
1. Open in Word/Google Docs
2. Apply heading styles:
   - **Heading 1** for chapters
   - **Heading 2** for sections
   - **Heading 3** for subsections
3. Re-export as RTF
4. Re-convert using our script

The conversion script uses these flags to detect headings:
```python
"--chapter", "//h:h1"           # Detect H1 as chapter
"--level1-toc", "//h:h1"        # Use H1 for TOC level 1
"--level2-toc", "//h:h2"        # Use H2 for TOC level 2
```

### Books Not Showing Up

1. Check `data.js` for syntax errors (must be valid JSON)
2. Verify file paths match exactly
3. Clear browser cache (Ctrl+Shift+R)
4. Check browser console for errors (F12)

### Conversion Script Errors

**"ebook-convert not found":**
- Install Calibre and add to PATH

**"No module named...":**
- Ensure Python 3 is installed
- Scripts use only standard library modules

### CORS Errors (Local Development)

**Problem:** Files won't load when opening `index.html` directly

**Solution:** Use a local server:
```bash
python3 -m http.server 8000
# or
npx serve
```

---

## 🆚 GitHub vs. Non-GitHub Deployment

| Feature | GitHub Pages | Your Own Server |
|---------|--------------|-----------------|
| **Hosting** | Free | Costs vary |
| **Auto-conversion** | Yes (Actions) | Manual scripts |
| **Custom domain** | Yes | Yes |
| **Storage limit** | 1GB | Unlimited* |
| **Bandwidth** | 100GB/month | Varies |
| **Setup difficulty** | Easy | Moderate |
| **Control** | Limited | Full |

*Depends on your hosting plan

### Disabling GitHub-Specific Features

If deploying outside GitHub, you may want to disable:

**Service Worker** (optional - used for offline caching):
Remove from `index.html`:
```html
<!-- Delete these lines -->
<script>
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}
</script>
```

**GitHub Actions** (only works on GitHub):
- Simply don't use it
- Use `batch_convert.py` instead

---

## 📝 Advanced: Manual Catalog Management

The `data.js` file contains your book catalog:
```javascript
const archiveData = [
  {
    "t": "Book Title",           // Title
    "a": "Author Name",          // Author
    "y": "2024",                 // Year
    "base": "filename",          // Base filename (no extension)
    "epub": true,                // Has ePUB version?
    "rtf": false                 // Has RTF version?
  }
];
```

You can edit this manually or use `batch_convert.py` to auto-generate it.

---

## 🎨 Customization Ideas

### Add Book Covers
1. Store covers in `books/covers/`
2. Add `"cover": "covers/title.jpg"` to data.js
3. Modify table rendering in `index.html`

### Add Categories
1. Add `"category": "Fiction"` to each book in data.js
2. Add category dropdown in index.html
3. Update `render()` function to filter by category

### Statistics Dashboard
Show total books, books by century, top authors, etc.:
```javascript
const stats = archiveData.reduce((acc, book) => {
    const century = Math.floor(parseInt(book.y) / 100) * 100;
    acc[century] = (acc[century] || 0) + 1;
    return acc;
}, {});
```

---

## 📚 Book Sources (Public Domain)

Free public domain books:
- **Project Gutenberg**: https://gutenberg.org
- **Internet Archive**: https://archive.org
- **Google Books**: https://books.google.com (filter by "Free")
- **Standard Ebooks**: https://standardebooks.org
- **Open Library**: https://openlibrary.org

⚠️ **Important:** Only add books that are in the public domain in your country!

---

## 🤝 Contributing

1. Fork this repository
2. Make your changes
3. Submit a pull request

**Ideas for contributions:**
- New themes
- Better mobile layout
- Advanced search features
- Book statistics
- Multi-language support

---

## 📄 License

This project is open source. The code is provided as-is for personal and educational use.

**Books:** Ensure all books you add are in the public domain or you have rights to distribute them.

---

## 💡 Tips for Best Results

### For Perfect Table of Contents:
1. **Use consistent heading styles** in your RTF files
2. **H1** = Chapter titles
3. **H2** = Section titles
4. **H3** = Subsection titles
5. Don't manually type "Chapter 1" in regular text - use Heading 1 style

### For Fast Loading:
- Keep ePUB files under 5MB
- Compress images in your books
- Use the service worker for caching

### For Better Search:
- Include complete metadata (title, author, year)
- Use consistent naming conventions
- Add books in chronological order

---

## 🆘 Support

**Having issues?**
1. Check this README first
2. Look at closed issues on GitHub
3. Open a new issue with:
   - What you're trying to do
   - What's happening instead
   - Error messages (F12 → Console)
   - Your hosting environment

---

## 🎓 Learn More

- **ePUB.js Documentation**: https://github.com/futurepress/epub.js
- **Calibre User Manual**: https://manual.calibre-ebook.com
- **Static Site Hosting**: https://jamstack.org/generators/

---

**Happy archiving! 📖✨**

Made with ❤️ for the public domain

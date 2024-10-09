const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

const app = express();
const port = 3000;

// Directories for static files
const templatesDir = path.join(__dirname, 'public', 'templates');
const depthImagesDir = path.join(__dirname, 'public', 'depth-images');

// Middleware setup
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Temporary upload storage for user-uploaded depth images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'temp'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/api/templates', (req, res) => {
    const templates = fs.readdirSync(templatesDir)
        .filter(file => file.match(/\.(png|jpg|jpeg)$/i))
        .map((filename, index) => ({
            id: index + 1,
            name: path.parse(filename).name,
            filename: filename
        }));
    res.json(templates);
});

app.get('/api/depth-images', (req, res) => {
    const depthImages = fs.readdirSync(depthImagesDir)
        .filter(file => file.match(/\.(png|jpg|jpeg)$/i))
        .map((filename, index) => ({
            id: index + 1,
            name: path.parse(filename).name,
            filename: filename
        }));
    res.json(depthImages);
});

app.post('/generate-stereogram', upload.single('depthImage'), async (req, res) => {
    try {
        const { separation, depthStrength, templateId, depthImageId } = req.body;
        let depthImagePath;

        // Handle both uploaded file and selected depth image cases
        if (req.file) {
            depthImagePath = req.file.path;
        } else if (depthImageId) {
            const depthImages = fs.readdirSync(depthImagesDir)
                .filter(file => file.match(/\.(png|jpg|jpeg)$/i));
            const filename = depthImages[parseInt(depthImageId) - 1];
            depthImagePath = path.join(depthImagesDir, filename);
        } else {
            throw new Error('No depth image provided');
        }

        // Load the depth image
        const depthImage = await loadImage(depthImagePath);
        
        // Get template image
        const templates = fs.readdirSync(templatesDir)
            .filter(file => file.match(/\.(png|jpg|jpeg)$/i));
        const templateFilename = templates[parseInt(templateId) - 1];
        const templateImage = await loadImage(path.join(templatesDir, templateFilename));

        // Generate stereogram
        const stereogram = createStereogram(depthImage, parseInt(separation), parseInt(depthStrength), templateImage);

        // Clean up temporary file if it was an upload
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temporary file:', err);
            });
        }

        // Send the generated stereogram
        res.set('Content-Type', 'image/png');
        stereogram.createPNGStream().pipe(res);
    } catch (error) {
        console.error('Error generating stereogram:', error);
        res.status(500).json({ error: 'An error occurred while generating the stereogram.' });
    }
});

// Stereogram generation functions
function createPattern(width, height, templateImage) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (templateImage) {
        const aspectRatio = templateImage.width / templateImage.height;
        const newHeight = width / aspectRatio;
        ctx.drawImage(templateImage, 0, 0, width, newHeight);
        
        let y = newHeight;
        while (y < height) {
            ctx.drawImage(canvas, 0, 0, width, newHeight, 0, y, width, Math.min(newHeight, height - y));
            y += newHeight;
        }
    } else {
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const value = Math.floor(Math.random() * 256);
            data[i] = value;     // Red
            data[i+1] = value;   // Green
            data[i+2] = value;   // Blue
            data[i+3] = 255;     // Alpha
        }
        ctx.putImageData(imageData, 0, 0);
    }

    return canvas;
}

function createStereogram(depth, separation, depthStrength, templateImage) {
    const width = depth.width;
    const height = depth.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const pattern = createPattern(separation, height, templateImage);
    const depthCanvas = createCanvas(width, height);
    const depthCtx = depthCanvas.getContext('2d');
    depthCtx.drawImage(depth, 0, 0);
    const depthData = depthCtx.getImageData(0, 0, width, height).data;

    for (let x = 0; x < width; x += separation) {
        ctx.drawImage(pattern, x, 0);
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (x < separation) continue;

            const depthValue = depthData[(y * width + x) * 4] / 255.0;
            const shift = Math.floor(depthValue * separation * (depthStrength / 100));
            
            const leftPos = x - separation + shift;
            const rightPos = x;

            if (leftPos >= 0 && leftPos < width) {
                for (let i = 0; i < 3; i++) {
                    pixels[(y * width + rightPos) * 4 + i] = pixels[(y * width + leftPos) * 4 + i];
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
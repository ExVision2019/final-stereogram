document.addEventListener('DOMContentLoaded', function() {
    const templateGrid = document.getElementById('templateGrid');
    const generateBtn = document.getElementById('generateBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const previewContainer = document.getElementById('previewContainer');
    const templatePreview = document.getElementById('templatePreview');
    const depthImageInput = document.getElementById('depthImage');

    const depthPreviewContainer = document.getElementById('depthPreviewContainer');
    depthPreviewContainer.classList.add('empty');
    depthPreviewContainer.classList.remove('hidden');

    // Fixed values for separation and depthStrength
    const separation = 170;
    const depthStrength = 25;

    let selectedTemplateId = null;
    let templateOptions = [];
    let hoverTimeout;
    let selectedDepthId = null;
    let depthImageOptions = [];
    let selectedDepthImageFilename = null;

    // Fetch and populate template options
    fetch('/api/templates')
    .then(response => response.json())
    .then(templates => {
        templateOptions = templates;
        templates.forEach(template => {
            const templateItem = document.createElement('div');
            templateItem.className = 'template-item';
            templateItem.innerHTML = `<img src="/templates/${template.filename}" alt="${template.name}">`;
            templateItem.dataset.value = template.id;
            templateItem.dataset.filename = template.filename;
            templateItem.dataset.name = template.name;
            templateGrid.appendChild(templateItem);

            templateItem.addEventListener('click', function() {
                selectTemplate(this);
            });

            templateItem.addEventListener('mouseenter', function() {
                const item = this;
                hoverTimeout = setTimeout(() => {
                    item.classList.add('hovered');
                }, 500);
            });

            templateItem.addEventListener('mouseleave', function() {
                clearTimeout(hoverTimeout);
                this.classList.remove('hovered');
            });
        });

        selectRandomTemplate();
    });

    fetch('/api/depth-images')
    .then(response => response.json())
    .then(depthImages => {
        depthImageOptions = depthImages;
        const depthImageGrid = document.getElementById('depthImageGrid');
        
        depthImages.forEach(depth => {
            const depthItem = document.createElement('div');
            depthItem.className = 'template-item';
            depthItem.innerHTML = `<img src="/depth-images/${depth.filename}" alt="${depth.name}">`;
            depthItem.dataset.value = depth.id;
            depthItem.dataset.filename = depth.filename;
            depthItem.dataset.name = depth.name;
            depthImageGrid.appendChild(depthItem);

            depthItem.addEventListener('click', function() {
                selectDepthImage(this);
            });
        });
    });

    function selectDepthImage(depthItem) {
        document.querySelectorAll('#depthImageGrid .template-item.selected')
            .forEach(item => item.classList.remove('selected'));
        depthItem.classList.add('selected');
        selectedDepthId = depthItem.dataset.value;
        selectedDepthImageFilename = depthItem.dataset.filename;
        updateDepthPreview(selectedDepthImageFilename);
        
        // Clear the file input when selecting from grid
        document.getElementById('depthImage').value = '';
    }

    function selectDepthImage(depthItem) {
        document.querySelectorAll('#depthImageGrid .template-item.selected')
            .forEach(item => item.classList.remove('selected'));
        depthItem.classList.add('selected');
        selectedDepthId = depthItem.dataset.value;
        selectedDepthImageFilename = depthItem.dataset.filename;
        
        const depthPreviewContainer = document.getElementById('depthPreviewContainer');
        const depthPreview = document.getElementById('depthPreview');
        
        if (selectedDepthImageFilename) {
            depthPreview.src = `/depth-images/${selectedDepthImageFilename}`;
            depthPreview.style.opacity = '1';
            depthPreviewContainer.classList.remove('empty');
            depthPreviewContainer.classList.remove('hidden');
        } else {
            depthPreview.src = '';
            depthPreview.style.opacity = '0';
            depthPreviewContainer.classList.add('empty');
        }
        
        // Clear the file input when selecting from grid
        document.getElementById('depthImage').value = '';
    }

    function selectRandomTemplate() {
        if (templateOptions.length > 0) {
            const randomIndex = Math.floor(Math.random() * templateOptions.length);
            const randomTemplate = templateGrid.children[randomIndex];
            selectTemplate(randomTemplate);
        }
    }

    function selectTemplate(templateItem) {
        document.querySelectorAll('.template-item.selected')
            .forEach(item => item.classList.remove('selected'));
        templateItem.classList.add('selected');
        selectedTemplateId = templateItem.dataset.value;
        updateTemplatePreview(templateItem.dataset.filename);
    }

    function updateTemplatePreview(filename) {
        if (filename) {
            const templatePath = `/templates/${filename}`;
            
            templatePreview.innerHTML = '';
            
            const previewWidth = previewContainer.clientWidth;
            const previewHeight = previewContainer.clientHeight;
            const tileSize = 50;
            const tilesX = Math.ceil(previewWidth / tileSize);
            const tilesY = Math.ceil(previewHeight / tileSize);
            
            for (let y = 0; y < tilesY; y++) {
                for (let x = 0; x < tilesX; x++) {
                    const img = document.createElement('img');
                    img.src = templatePath;
                    img.alt = 'Template preview tile';
                    templatePreview.appendChild(img);
                }
            }
            
            previewContainer.classList.remove('hidden');
        } else {
            previewContainer.classList.add('hidden');
        }
    }

    generateBtn.addEventListener('click', function() {
        const depthImageFile = depthImageInput.files[0];
        
        if ((!depthImageFile && !selectedDepthId) || !selectedTemplateId) {
            alert('Please select both a depth image and a template.');
            return;
        }
    
        const formData = new FormData();
        formData.append('separation', separation);
        formData.append('depthStrength', depthStrength);
        if (depthImageFile) {
            formData.append('depthImage', depthImageFile);
        } else {
            formData.append('depthImageId', selectedDepthId);
        }
        formData.append('templateId', selectedTemplateId);
    
        fetch('/generate-stereogram', {
            method: 'POST',
            body: formData
        })
        .then(response => response.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            document.getElementById('stereogramPreview').src = url;
            document.getElementById('stereogramPreviewContainer').classList.remove('hidden');
            
            downloadBtn.onclick = function() {
                const a = document.createElement('a');
                a.href = url;
                a.download = 'stereogram.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
            downloadBtn.classList.remove('hidden');
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while generating the stereogram.');
        });
    });

    depthImageInput.addEventListener('change', function() {
        document.querySelectorAll('#depthImageGrid .template-item.selected')
            .forEach(item => item.classList.remove('selected'));
        selectedDepthId = null;
        
        const depthPreviewContainer = document.getElementById('depthPreviewContainer');
        const depthPreview = document.getElementById('depthPreview');
        
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                depthPreview.src = e.target.result;
                depthPreview.style.opacity = '1';
                depthPreviewContainer.classList.remove('empty');
                depthPreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(this.files[0]);
        } else {
            depthPreview.src = '';
            depthPreview.style.opacity = '0';
            depthPreviewContainer.classList.add('empty');
        }
    });
    window.addEventListener('resize', () => {
        if (selectedTemplateId) {
            const selectedTemplate = document.querySelector(`.template-item[data-value="${selectedTemplateId}"]`);
            updateTemplatePreview(selectedTemplate.dataset.filename);
        }
        if (selectedDepthId || depthImageInput.files.length > 0) {
            // No need to update the depth preview on resize since it's not tiled
        }
    });
});
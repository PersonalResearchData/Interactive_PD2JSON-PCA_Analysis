// --- Global Variables ---
let processedData = null;

// --- DOM Element References ---
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const loadingIndicator = document.getElementById('loading');
const resultsSection = document.getElementById('results');
const statsGrid = document.getElementById('statsGrid');

// --- Event Listeners ---

// Drag and Drop Listeners
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => uploadArea.classList.add('scale-105', 'border-blue-500', 'bg-blue-50'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('scale-105', 'border-blue-500', 'bg-blue-50'), false);
});

// File Handling Listeners
uploadArea.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// --- Functions ---

/**
 * Handles the selected files from either drag-drop or file input.
 * @param {FileList} files - The list of files to process.
 */
function handleFiles(files) {
    if (files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith('.json')) {
        alert("Please upload a valid '.json' file.");
        return;
    }
    displayFileList(file);
    processFile(file);
}

/**
 * Displays the name of the uploaded file.
 * @param {File} file - The file that was uploaded.
 */
function displayFileList(file) {
    fileList.innerHTML = `<div class="bg-gray-100 p-3 rounded-lg flex justify-between items-center mb-2"><span class="font-medium text-gray-700">${file.name}</span></div>`;
}

/**
 * Reads and parses the JSON file, then triggers the display of results.
 * @param {File} file - The JSON file to process.
 */
async function processFile(file) {
    loadingIndicator.style.display = 'block';
    resultsSection.style.display = 'none';
    
    try {
        const content = await file.text();
        processedData = JSON.parse(content);
        // Basic validation to ensure required data exists
        if (!processedData.points || !processedData.explained_variance_ratio_all || !processedData.cumulative_variance_ratio_all) {
            throw new Error("Invalid JSON format. Required keys (points, explained_variance_ratio_all, cumulative_variance_ratio_all) are missing.");
        }
        displayResults();
    } catch (error) {
        console.error('Processing error:', error);
        alert('Error processing file: ' + error.message);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Displays all result sections and initializes plots.
 */
function displayResults() {
    if (!processedData) return;
    resultsSection.style.display = 'block';
    
    displayStats();
    initializeSectionToggles();
    
    // Trigger initial plot rendering for visible sections
    document.querySelectorAll('.section-toggle.active').forEach(button => {
        const sectionName = button.dataset.section;
        switch(sectionName) {
            case 'pca': plotPCA(); break;
            case 'contribution': plotContributions(); break;
            case 'cumulative': plotCumulative(); break;
        }
    });
}

/**
 * Populates the statistics grid with key metrics from the data.
 */
function displayStats() {
    const expVar = processedData.explained_variance_ratio_all;
    const pointsCount = processedData.points.length;
    
    statsGrid.innerHTML = `
        <div class="stat-card bg-white p-4 rounded-lg shadow text-center"><h3 class="text-2xl font-bold text-blue-600">${pointsCount}</h3><p>Data Points</p></div>
        <div class="stat-card bg-white p-4 rounded-lg shadow text-center"><h3 class="text-2xl font-bold text-blue-600">${(expVar[0] * 100).toFixed(1)}%</h3><p>PC1 Variance</p></div>
        <div class="stat-card bg-white p-4 rounded-lg shadow text-center"><h3 class="text-2xl font-bold text-blue-600">${(expVar[1] * 100).toFixed(1)}%</h3><p>PC2 Variance</p></div>
        <div class="stat-card bg-white p-4 rounded-lg shadow text-center"><h3 class="text-2xl font-bold text-blue-600">${(processedData.cumulative_variance_ratio_all[1] * 100).toFixed(1)}%</h3><p>PC1+PC2 Cum. Var.</p></div>
    `;
}

/**
 * Renders the 2D PCA scatter plot.
 */
function plotPCA() {
    const container = document.getElementById('pca-section');
    if (container.style.display === 'none') return;
    
    let colorValues;
    let colorBarTitle = 'File Index';
    
    const labels = processedData.points.map(p => p.label);
    
    // Attempt to extract time values for coloring
    const timeValues = labels.map((label) => {
        const timeMatch = label.match(/(\d+(?:\.\d+)?)\s*(fs|ps|ns)/);
        if (timeMatch) {
            let timeValue = parseFloat(timeMatch[1]);
            const unit = timeMatch[2];
            if (unit === 'fs') timeValue /= 1000; // convert to ps
            else if (unit === 'ns') timeValue *= 1000; // convert to ps
            return timeValue;
        }
        return null; // Return null if no time found
    });

    // Check if any valid time values were extracted
    const validTimeValues = timeValues.filter(v => v !== null);

    if (validTimeValues.length > 0) {
        // Use time values for color, with index as fallback
        colorValues = timeValues.map((v, i) => v === null ? i : v); 
        colorBarTitle = 'Time (ps)';
    } else {
        // Fallback to using index if no time data is found
        colorValues = labels.map((_, index) => index);
    }
            
    const trace = {
        x: processedData.points.map(p => p.x),
        y: processedData.points.map(p => p.y),
        mode: 'markers',
        type: 'scatter',
        text: labels,
        marker: {
            size: 12,
            color: colorValues,
            colorscale: 'Viridis',
            colorbar: { title: { text: colorBarTitle, font: { size: 14 } } },
            showscale: true,
            opacity: 0.8,
        },
        hovertemplate: '<b>%{text}</b><br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>'
    };

    const layout = {
        xaxis: { title: `PC1 (${(processedData.explained_variance_ratio_all[0] * 100).toFixed(2)}%)` },
        yaxis: { title: `PC2 (${(processedData.explained_variance_ratio_all[1] * 100).toFixed(2)}%)` },
        hovermode: 'closest',
        margin: { t: 50, b: 50, l: 60, r: 40 }
    };

    Plotly.newPlot('pcaPlot', [trace], layout, {responsive: true});
}

/**
 * Renders the bar chart for principal component contributions.
 */
function plotContributions() {
    const container = document.getElementById('contribution-section');
    if (container.style.display === 'none') return;

    const n = processedData.explained_variance_ratio_all.length;
    const components = Array.from({length: n}, (_, i) => `PC${i+1}`);
    
    const trace = {
        x: components,
        y: processedData.explained_variance_ratio_all,
        type: 'bar',
        text: processedData.explained_variance_ratio_all.map(v => `${(v * 100).toFixed(2)}%`),
        textposition: 'auto',
        marker: { color: '#3b82f6' }
    };

    const layout = {
        xaxis: { title: 'Principal Component' },
        yaxis: { title: 'Explained Variance Ratio' },
        margin: { t: 20, b: 50, l: 60, r: 40 }
    };

    Plotly.newPlot('contributionPlot', [trace], layout, {responsive: true});
}

/**
 * Renders the line chart for cumulative variance.
 */
function plotCumulative() {
    const container = document.getElementById('cumulative-section');
    if (container.style.display === 'none') return;

    const n = processedData.cumulative_variance_ratio_all.length;
    const components = Array.from({length: n}, (_, i) => `PC${i+1}`);

    const trace = {
        x: components,
        y: processedData.cumulative_variance_ratio_all,
        type: 'scatter',
        mode: 'lines+markers',
        marker: { color: '#16a34a', size: 8 },
        line: { color: '#16a34a', width: 3 }
    };
    
    const layout = {
        xaxis: { title: 'Principal Component' },
        yaxis: { title: 'Cumulative Variance Ratio', range: [0, 1.1] },
        margin: { t: 20, b: 50, l: 60, r: 40 }
    };

    Plotly.newPlot('cumulativePlot', [trace], layout, {responsive: true});
}

/**
 * Sets up the click handlers for the section toggle buttons.
 */
function initializeSectionToggles() {
    const plotFunctions = {
        'pca': plotPCA,
        'contribution': plotContributions,
        'cumulative': plotCumulative
    };

    document.querySelectorAll('.section-toggle').forEach(button => {
        button.onclick = function() {
            const sectionName = this.dataset.section;
            const section = document.getElementById(`${sectionName}-section`);
            
            const isActive = this.classList.toggle('active');
            
            // Update button styles
            this.classList.toggle('bg-blue-600', isActive);
            this.classList.toggle('text-white', isActive);
            this.classList.toggle('bg-gray-200', !isActive);
            this.classList.toggle('text-gray-700', !isActive);
            this.classList.toggle('hover:bg-gray-300', !isActive);
            
            if (isActive) {
                section.style.display = 'block';
                // Re-render plot in case it was created while hidden and its container had no size
                setTimeout(() => plotFunctions[sectionName](), 50);
            } else {
                section.style.display = 'none';
            }
        };
    });
}

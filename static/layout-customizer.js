/**
 * 🎨 Visual Layout Customizer
 * Drag & Drop karke sections ko resize karo
 */

class LayoutCustomizer {
    constructor() {
        this.isCustomizerActive = false;
        this.currentLayout = {
            leftWidth: 550,
            rightWidth: 380
        };
        this.init();
    }

    init() {
        this.createCustomizerUI();
        this.attachEventListeners();
    }

    createCustomizerUI() {
        // Customizer toggle button
        const customizerBtn = document.createElement('button');
        customizerBtn.id = 'customizerToggle';
        customizerBtn.className = 'customizer-toggle';
        customizerBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 15l-3-3h6l-3 3z" fill="currentColor"/>
                <rect x="3" y="4" width="18" height="4" rx="1" fill="currentColor" opacity="0.5"/>
                <rect x="3" y="10" width="10" height="4" rx="1" fill="currentColor"/>
                <rect x="15" y="10" width="6" height="4" rx="1" fill="currentColor"/>
            </svg>
            <span>Layout Editor</span>
        `;
        document.body.appendChild(customizerBtn);

        // Customizer panel
        const panel = document.createElement('div');
        panel.id = 'customizerPanel';
        panel.className = 'customizer-panel hidden';
        panel.innerHTML = `
            <div class="customizer-header">
                <h3>🎨 Layout Customizer</h3>
                <button class="close-customizer">×</button>
            </div>
            
            <div class="customizer-body">
                <div class="control-group">
                    <label>📊 Left Column Width (NASA/Forecast)</label>
                    <div class="slider-container">
                        <input type="range" id="leftWidthSlider" min="300" max="800" value="550" step="10">
                        <span class="slider-value"><span id="leftWidthValue">550</span>px</span>
                    </div>
                </div>

                <div class="control-group">
                    <label>🌬️ Right Column Width (Pollutants)</label>
                    <div class="slider-container">
                        <input type="range" id="rightWidthSlider" min="300" max="600" value="380" step="10">
                        <span class="slider-value"><span id="rightWidthValue">380</span>px</span>
                    </div>
                </div>

                <div class="layout-preview">
                    <div class="preview-title">Preview:</div>
                    <div class="preview-grid">
                        <div class="preview-col left" id="previewLeft">
                            <span>Left</span>
                            <small id="leftPreviewSize">550px</small>
                        </div>
                        <div class="preview-col center">
                            <span>Map</span>
                            <small>Auto</small>
                        </div>
                        <div class="preview-col right" id="previewRight">
                            <span>Right</span>
                            <small id="rightPreviewSize">380px</small>
                        </div>
                    </div>
                </div>

                <div class="preset-layouts">
                    <div class="preset-title">⚡ Quick Presets:</div>
                    <div class="preset-buttons">
                        <button class="preset-btn" data-left="400" data-right="400">
                            <span>Balanced</span>
                            <small>400 | Auto | 400</small>
                        </button>
                        <button class="preset-btn" data-left="600" data-right="350">
                            <span>Focus Left</span>
                            <small>600 | Auto | 350</small>
                        </button>
                        <button class="preset-btn" data-left="400" data-right="500">
                            <span>Focus Right</span>
                            <small>400 | Auto | 500</small>
                        </button>
                        <button class="preset-btn" data-left="550" data-right="380">
                            <span>Default</span>
                            <small>550 | Auto | 380</small>
                        </button>
                    </div>
                </div>

                <div class="action-buttons">
                    <button id="applyLayout" class="apply-btn">
                        ✅ Apply Layout
                    </button>
                    <button id="resetLayout" class="reset-btn">
                        🔄 Reset to Default
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
    }

    attachEventListeners() {
        // Toggle customizer
        document.getElementById('customizerToggle').addEventListener('click', () => {
            this.toggleCustomizer();
        });

        // Close button
        document.querySelector('.close-customizer').addEventListener('click', () => {
            this.closeCustomizer();
        });

        // Sliders
        const leftSlider = document.getElementById('leftWidthSlider');
        const rightSlider = document.getElementById('rightWidthSlider');

        leftSlider.addEventListener('input', (e) => {
            this.updatePreview('left', e.target.value);
        });

        rightSlider.addEventListener('input', (e) => {
            this.updatePreview('right', e.target.value);
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const left = e.currentTarget.dataset.left;
                const right = e.currentTarget.dataset.right;
                this.applyPreset(left, right);
            });
        });

        // Apply button
        document.getElementById('applyLayout').addEventListener('click', () => {
            this.applyLayout();
        });

        // Reset button
        document.getElementById('resetLayout').addEventListener('click', () => {
            this.resetLayout();
        });

        // Drag & Drop on columns
        this.initDragResize();
    }

    toggleCustomizer() {
        const panel = document.getElementById('customizerPanel');
        panel.classList.toggle('hidden');
        this.isCustomizerActive = !this.isCustomizerActive;

        if (this.isCustomizerActive) {
            document.getElementById('customizerToggle').classList.add('active');
        } else {
            document.getElementById('customizerToggle').classList.remove('active');
        }
    }

    closeCustomizer() {
        document.getElementById('customizerPanel').classList.add('hidden');
        document.getElementById('customizerToggle').classList.remove('active');
        this.isCustomizerActive = false;
    }

    updatePreview(column, value) {
        if (column === 'left') {
            document.getElementById('leftWidthValue').textContent = value;
            document.getElementById('leftPreviewSize').textContent = `${value}px`;
            document.getElementById('previewLeft').style.width = `${(value / 1400) * 100}%`;
            this.currentLayout.leftWidth = parseInt(value);
        } else if (column === 'right') {
            document.getElementById('rightWidthValue').textContent = value;
            document.getElementById('rightPreviewSize').textContent = `${value}px`;
            document.getElementById('previewRight').style.width = `${(value / 1400) * 100}%`;
            this.currentLayout.rightWidth = parseInt(value);
        }
    }

    applyPreset(left, right) {
        document.getElementById('leftWidthSlider').value = left;
        document.getElementById('rightWidthSlider').value = right;
        this.updatePreview('left', left);
        this.updatePreview('right', right);
    }

    applyLayout() {
        const leftWidth = this.currentLayout.leftWidth;
        const rightWidth = this.currentLayout.rightWidth;

        // Update CSS grid
        const layout = document.querySelector('.layout');
        if (layout) {
            layout.style.gridTemplateColumns = `${leftWidth}px 1fr ${rightWidth}px`;
        }

        // Show success notification
        this.showNotification('✅ Layout Applied Successfully!', 'success');

        // Save to localStorage
        localStorage.setItem('customLayout', JSON.stringify(this.currentLayout));
    }

    resetLayout() {
        this.currentLayout = { leftWidth: 550, rightWidth: 380 };
        document.getElementById('leftWidthSlider').value = 550;
        document.getElementById('rightWidthSlider').value = 380;
        this.updatePreview('left', 550);
        this.updatePreview('right', 380);
        this.applyLayout();
        this.showNotification('🔄 Layout Reset to Default', 'info');
    }

    initDragResize() {
        // Add resize handles between columns
        const layout = document.querySelector('.layout');
        if (!layout) return;

        // Left resize handle
        const leftHandle = document.createElement('div');
        leftHandle.className = 'resize-handle resize-handle-left';
        leftHandle.innerHTML = '<div class="handle-line"></div>';
        
        // Right resize handle
        const rightHandle = document.createElement('div');
        rightHandle.className = 'resize-handle resize-handle-right';
        rightHandle.innerHTML = '<div class="handle-line"></div>';

        const nasaSection = document.querySelector('.nasa-left-section');
        const pollutantsSection = document.querySelector('.pollutants-right-section');

        if (nasaSection) {
            nasaSection.style.position = 'relative';
            nasaSection.appendChild(leftHandle);
        }

        if (pollutantsSection) {
            pollutantsSection.style.position = 'relative';
            pollutantsSection.appendChild(rightHandle);
        }

        // Make handles draggable
        this.makeDraggable(leftHandle, 'left');
        this.makeDraggable(rightHandle, 'right');
    }

    makeDraggable(handle, side) {
        let startX, startWidth;

        handle.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            
            if (side === 'left') {
                startWidth = this.currentLayout.leftWidth;
            } else {
                startWidth = this.currentLayout.rightWidth;
            }

            const onMouseMove = (e) => {
                const diff = e.clientX - startX;
                let newWidth = side === 'left' ? startWidth + diff : startWidth - diff;
                
                // Constraints
                newWidth = Math.max(300, Math.min(800, newWidth));

                if (side === 'left') {
                    document.getElementById('leftWidthSlider').value = newWidth;
                    this.updatePreview('left', newWidth);
                } else {
                    document.getElementById('rightWidthSlider').value = newWidth;
                    this.updatePreview('right', newWidth);
                }

                this.applyLayout();
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                handle.classList.remove('dragging');
            };

            handle.classList.add('dragging');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            e.preventDefault();
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `layout-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // Load saved layout on init
    loadSavedLayout() {
        const saved = localStorage.getItem('customLayout');
        if (saved) {
            const layout = JSON.parse(saved);
            this.currentLayout = layout;
            document.getElementById('leftWidthSlider').value = layout.leftWidth;
            document.getElementById('rightWidthSlider').value = layout.rightWidth;
            this.updatePreview('left', layout.leftWidth);
            this.updatePreview('right', layout.rightWidth);
            this.applyLayout();
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const customizer = new LayoutCustomizer();
    customizer.loadSavedLayout();
    
    console.log('🎨 Layout Customizer Loaded! Click the Layout Editor button to customize.');
});

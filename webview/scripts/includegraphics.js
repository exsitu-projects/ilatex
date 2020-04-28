// Return a CSS pixel value (rounded to closest integer)
function px(n) {
    return `${Math.round(n)}px`;
}

// Return the number of pixels of a CSS length in pixels (without the 'px' suffix)
function nbPx(str) {
    return parseFloat(str, 10);
}

function firstDefined(value, fallback) {
    return (value !== undefined) ? value : fallback;
}

class ImageFrame {
    constructor(visualisation) {
        this.visualisation = visualisation;
        this.frame = visualisation.querySelector(".frame");
        this.ghost = this.frame.querySelector('.ghost');
        this.inner = this.frame.querySelector('.inner');
        this.img = this.inner.querySelector('.image');
        this.resize = this.frame.querySelector('.resize');

        // Length of the string of the last generated command (>=0 if any)
        // This is temporarily required to replace the right amound of text
        // without re-parsing the entire document after each change
        this.lastGeneratedCommandLength = -1;

        // Get the path and the options of the command
        this.path = this.visualisation.getAttribute("data-img-path");
        this.options = {};
        this.initOptions();
        
        // Get data from the mask and the pdf page related to this visualisation
        const sourceIndex = parseInt(visualisation.getAttribute("data-source-index"));
        const annotationMaskNode = findMaskNodeWithIndex(sourceIndex);
        this.initFrameScale = annotationMaskNode.clientWidth / annotationMaskNode.clientHeight;

        const pdfPageNumberStr = annotationMaskNode.getAttribute("data-page-number");
        const pdfPageNode = findPageNode(pdfPageNumberStr);
        const viewportScale = parseFloat(pdfPageNode.getAttribute("data-viewport-scale"));

        // Set the dimensions of the frame
        this.frameWidth = annotationMaskNode.clientWidth;
        this.frameHeight = annotationMaskNode.clientHeight;

        this.updateFrameDimensions();

        // Set the initial scaling factor
        this.scale = 1;

        // Trim values are given in px (possibly converted from the source code)
        // and must therefore be scaled to match the size of the pixels of the rendered PDF
        // (since the PDF is scaled to fit in the canvas, they may be of different sizes)
        const top = firstDefined(this.options.trim.top, 0);
        const bottom = firstDefined(this.options.trim.bottom, 0);
        const left = firstDefined(this.options.trim.left, 0);
        const right = firstDefined(this.options.trim.right, 0);

        const croppedNaturalWidth = this.img.naturalWidth - left - right;
        const croppedNaturalHeight = this.img.naturalHeight - top - bottom;

        let horizontalTrimScale = 1;
        let verticalTrimScale = 1;

        if (this.options.width && !this.options.height) {
            const scaleToFitSizeParameter = this.options.width / croppedNaturalWidth;
            horizontalTrimScale = scaleToFitSizeParameter;
            verticalTrimScale = scaleToFitSizeParameter;
        }
        else if (!this.options.width && this.options.height) {
            const scaleToFitSizeParameter = this.options.height / croppedNaturalHeight;
            horizontalTrimScale = scaleToFitSizeParameter;
            verticalTrimScale = scaleToFitSizeParameter;           
        }
        else if (this.options.width && this.options.height) {
            horizontalTrimScale = this.options.width / croppedNaturalWidth;
            verticalTrimScale = this.options.height / croppedNaturalHeight;
        }
        else if (this.options.scale) {
            // TODO
        }

        const scaledTop = top * verticalTrimScale;
        const scaledBottom = bottom * verticalTrimScale;
        const scaledLeft = left * horizontalTrimScale;
        const scaledRight = right * horizontalTrimScale;

        // Offsets and dimensions can be computed
        // from the scaled trim values and the scale of the rendered PDF
        this.offsetX = -scaledLeft * viewportScale;
        this.offsetY = -scaledTop * viewportScale;

        this.imageWidth = ((scaledLeft + scaledRight) * viewportScale) + this.frameWidth;
        this.imageHeight = ((scaledTop + scaledBottom) * viewportScale) + this.frameHeight;

        // console.log("Image " + this.img.src);
        // console.log("options", this.options);
        // console.log(
        //     "frame", this.frameWidth, this.frameHeight,
        //     "image", this.imageWidth, this.imageHeight
        // );

        this.updateImagesDimensions();
        this.updateImagesPositions();
        
        // Initialise the interaction state
        this.dragInfo = {
            type: null,
            cursorX: 0,
            cursorY: 0,
            dx: 0,
            dy: 0
        };

        this.dragAction = {};
        
        this.initDragActions();
        this.addEventListeners();
    }

    updateFrameDimensions() {
        this.frame.style.width = px(this.frameWidth);
        this.frame.style.height = px(this.frameHeight);

        // Keep the frame centered
        this.frame.style.marginLeft = px(-this.frameWidth / 2);

        this.updateVisualisationDimensions();
    }

    updateImagesDimensions() {
        const newImageWidth = this.imageWidth * this.scale;
        const newImageHeight = this.imageHeight * this.scale;

        this.img.style.width = px(newImageWidth);
        this.img.style.height = px(newImageHeight);

        this.ghost.style.width = px(newImageWidth);
        this.ghost.style.height = px(newImageHeight);
    }

    updateImagesPositions() {
        this.img.style.left = px(this.offsetX);
        this.img.style.top = px(this.offsetY);

        this.ghost.style.left = px(this.offsetX);
        this.ghost.style.top = px(this.offsetY);
    }

    updateVisualisationDimensions() {
        const padding = 5; // px
        this.visualisation.style.height = px(this.frameHeight + (2 * padding));
    }

    initOptions() {
        const visualisation = this.visualisation;
        const options = this.options;
        function setOptionFromAttr(key, attrName, map = parseFloat, obj = options) {
            if (visualisation.hasAttribute(attrName)) {
                obj[key] = map(visualisation.getAttribute(attrName));
            }
        }

        setOptionFromAttr("width", "data-opt-width");
        setOptionFromAttr("height", "data-opt-height");
        setOptionFromAttr("scale", "data-opt-scale");

        this.options.trim = {};
        ["left", "bottom", "right", "top"]
            .filter(direction => visualisation.hasAttribute(`data-opt-trim-${direction}`))
            .forEach(direction =>
                setOptionFromAttr(direction, `data-opt-trim-${direction}`, parseFloat, this.options.trim)
            );

        setOptionFromAttr("clip", "data-opt-clip", clipValue => clipValue);
    }

    initDragActions() {
        // Drag image in frame
        this.dragAction.image = (ev) => {
            this.offsetX += this.dragInfo.dx;
            this.offsetY += this.dragInfo.dy;
            this.updateImagesPositions();
        };

        this.dragAction.resize = (ev) => {
            this.frameWidth += this.dragInfo.dx;
            this.frameHeight += this.dragInfo.dy;
            this.updateFrameDimensions();
        };
    }

    // Record cursor position and drag type
    startDrag(ev, type) {
        this.dragInfo.cursorX = ev.screenX;
        this.dragInfo.cursorY = ev.screenY;
        this.dragInfo.type = type;

        ev.preventDefault();
    }

    // Dispatch drag event
    doDrag(ev) {
        if (! this.dragInfo.type) {
            return;
        }

        ev.preventDefault();

        this.dragInfo.dx = ev.screenX - this.dragInfo.cursorX;
        this.dragInfo.dy = ev.screenY - this.dragInfo.cursorY;
        this.dragInfo.cursorX = ev.screenX;
        this.dragInfo.cursorY = ev.screenY;

        this.dragAction[this.dragInfo.type](ev);

        this.updateLayout();
    }

    // Done dragging
    endDrag(ev) {
        this.dragInfo.type = null;
        ev.preventDefault();
    }

    addEventListeners() {
        // Mouse listeners (image dragging)
        this.ghost.addEventListener('mousedown', ev => this.startDrag(ev, 'image'));
        this.img.addEventListener('mousedown', ev => this.startDrag(ev, 'image'));
        this.resize.addEventListener('mousedown', ev => this.startDrag(ev, 'resize'));

        // TODO: add the listeners elsewhere or remove them at some point
        document.addEventListener('mousemove', ev => this.doDrag(ev));
        document.addEventListener('mouseup', ev => this.endDrag(ev));

        // Scroll wheel listener (image zoom)
        this.visualisation.addEventListener('wheel', ev => {
            ev.preventDefault();

            let ds;
            if (ev.deltaY > 0) { // enlarge
                ds = 1 + ev.deltaY/50;
            }
            else if (ev.deltaY < 0) { // shrink
                ds = 1/(1 - ev.deltaY/50);
            }
            else {
                return;
            }

            let newScaleX = this.scale * ds;
            let newScaleY = this.scale * ds;
            if (newScaleX > 0.1 && newScaleY > 0.1) {
                // Update the scale of the images
                this.scale = newScaleX;
                this.scale = newScaleY;

                this.updateImagesDimensions();
                
                // const rect = this.ghost.getBoundingClientRect();
                // this.offsetX += (1 - ds)*(ev.clientX - rect.x);
                // this.offsetY += (1 - ds)*(ev.clientY - rect.y);
                // this.ghost.style.left = this.img.style.left = px(this.offsetX);
                // this.ghost.style.top = this.img.style.top = px(this.offsetY);

                this.updateLayout();
            }
        });

        // Keyboard listner (turn the ghost on/off)
        document.addEventListener('keydown', ev => {
            if (ev.key === ' ') {
                this.ghost.classList.toggle('hidden');
            }
        });
    }

    // Display image layout
    updateLayout() {
        const scale = this.scale;
        let width = this.frameWidth;
        let height = this.frameHeight;
        let right = this.offsetX + this.imageWidth*scale;
        let bottom = this.offsetY + this.imageHeight*scale;

        if (this.offsetX > this.frameWidth
        ||  this.offsetY > this.frameHeight
        ||  right < 0
        ||  bottom < 0) {
            return;
        }

        let trim = {
            left: 0, bottom: 0, right: 0, top: 0
        };

        if (this.offsetX > 0) {
            width -= this.offsetX;
        }
        else if (this.offsetX < 0) {
            trim.left = -this.offsetX;
        }

        if (right < this.frameWidth) {
            width -= this.frameWidth - right;
        }
        else {
            trim.right = right - this.frameWidth;
        }

        if (this.offsetY > 0) {
            height -= this.offsetY;
        }
        else if (this.offsetY < 0) {
            trim.top = -this.offsetY;
        }

        if (bottom < this.frameHeight) {
            height -= this.frameHeight - bottom;
        }
        else {
            trim.bottom = bottom - this.frameHeight;
        }

        // Object of option name/value tuples to set in the code
        let optionsAsStr = `width=${px(width)}, height=${px(height)}`;
        const options = {
            width: px(width),
            height: px(height)
        };

        if (trim.left !== 0 || trim.bottom !== 0 || trim.right !== 0 || trim.top !== 0) {
            options.left = px((trim.left / this.imageWidth) * this.img.naturalWidth / scale);
            options.bottom = px((trim.bottom / this.imageHeight) * this.img.naturalHeight / scale);
            options.right = px((trim.right / this.imageWidth) * this.img.naturalWidth / scale);
            options.top = px((trim.top / this.imageHeight) * this.img.naturalHeight / scale);

            options.clip = true;

            optionsAsStr += `, trim=${options.left} ${options.bottom} ${options.right} ${options.top}, clip`;
        }

        notifyVisualisation(this.visualisation, "set-options", {
            options: options,
            optionsAsStr: optionsAsStr
        });
        
    }
}

pdfNode.addEventListener("visualisation-displayed", event => {
    const visualisationNode = event.detail.visualisationNode;
    
    if (visualisationNode.getAttribute("data-name") === "includegraphics") {
        new ImageFrame(visualisationNode);
    }
});

pdfNode.addEventListener("visualisation-hidden", event => {
    const visualisationNode = event.detail.visualisationNode;
    
    if (visualisationNode.getAttribute("data-name") === "includegraphics") {
        // TODO
    }
});
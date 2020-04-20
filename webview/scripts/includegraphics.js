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
        this.text = visualisation.querySelector('.text');
        this.frame = visualisation.querySelector(".frame");
        this.ghost = this.frame.querySelector('.ghost');
        this.inner = this.frame.querySelector('.inner');
        this.img = this.inner.querySelector('.image');
        this.resize = this.frame.querySelector('.resize');

        // length of the string of the last generated command (>=0 if any)
        // this is temporarily required to replace the right amound of text
        // without re-parsing the entire document after each change
        this.lastGeneratedCommandLength = -1;

        // path and options of the command
        this.path = this.visualisation.getAttribute("data-img-path");
        this.options = {};
        this.initOptions();
        
        // frame resize
        this.frameWidth = firstDefined(this.options.width, 200); // TODO: use better defaults
        this.frameHeight = firstDefined(this.options.height, 200); // TODO: use better defaults
        this.updateFrameDimensions();

        // image transform
        this.imageWidth = parseFloat(this.visualisation.getAttribute("data-img-width"));
        this.imageHeight = parseFloat(this.visualisation.getAttribute("data-img-height"));
        this.scale = firstDefined(this.options.scale, 1);
        this.offsetX = 0; // TODO: compute from parameters
        this.offsetY = 0; // TODO: compute from parameters
        this.updateImagesDimensions();
        
        // interaction state
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
        this.img.style.width = px(this.imageWidth);
        this.img.style.height = px(this.imageHeight);
        this.ghost.style.width = px(this.imageWidth);
        this.ghost.style.height = px(this.imageHeight);
        
        this.updateVisualisationDimensions();
    }

    updateVisualisationDimensions() {
        const padding = 5; // px
        this.visualisation.style.height = px(
            this.frameHeight + (2 * padding)
        );
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

        if (["left", "botton", "right", "top"].some(dir =>
            visualisation.hasAttribute(`data-opt-trim-${dir}`)
        )) {
            this.options.trim = {};
            setOptionFromAttr("left", "data-opt-trim-left", parseFloat, this.options.trim);
            setOptionFromAttr("botton", "data-opt-trim-botton", parseFloat, this.options.trim);
            setOptionFromAttr("right", "data-opt-trim-right", parseFloat, this.options.trim);
            setOptionFromAttr("top", "data-opt-trim-top", parseFloat, this.options.trim);
        }

        setOptionFromAttr("scale", "data-opt-scale", clipValue => clipValue);
    }

    initDragActions() {
        // Drag image in frame
        this.dragAction.image = (ev) => {
            this.offsetX += this.dragInfo.dx;
            this.offsetY += this.dragInfo.dy;
            this.ghost.style.left = this.img.style.left = px(this.offsetX);
            this.ghost.style.top = this.img.style.top = px(this.offsetY);
        };

        this.dragAction.resize = (ev) => {
            this.frameWidth += this.dragInfo.dx;
            this.frameHeight += this.dragInfo.dy;
            this.updateFrameDimensions();
        };
    }

    // Center the ghost and the frame
    // centerImages() {
    //     this.offsetX = -(this.img.width - this.frameWidth) / 2
    //     this.offsetY = -(this.img.height - this.frameHeight) / 2

    //     this.ghost.style.left = this.img.style.left = px(this.offsetX)
    //     this.ghost.style.top = this.img.style.top = px(this.offsetY)
    // }

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

            let newScale = this.scale * ds;
            if (newScale > 0.1) {
                // Update the scale of the images
                this.scale = newScale;
                this.rescaleImages();
                
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

    // Update the scale factor of the image and the ghost
    rescaleImages() {
        const newImageWidth = this.imageWidth * this.scale;
        const newImageHeight = this.imageHeight * this.scale;

        this.img.style.width = px(newImageWidth);
        this.img.style.height = px(newImageHeight);

        this.ghost.style.width = px(newImageWidth);
        this.ghost.style.height = px(newImageHeight);
    }

    // Display image layout
    updateLayout() {
        let scale = this.scale;
        let frame = `frame=${px(this.frameWidth)}, ${px(this.frameHeight)} - offset=${px(this.offsetX)}, ${px(this.offsetY)} - scale=${Math.round(scale*1000)/1000}`;

        let width = this.frameWidth;
        let height = this.frameHeight;
        let right = this.offsetX + this.imageWidth*scale;
        let bottom = this.offsetY + this.imageHeight*scale;

        if (this.offsetX > this.frameWidth || this.offsetY > this.frameHeight || right < 0 || bottom < 0) {
            this.text.innerHTML = frame + ' image out of bounds';
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

        // frame += `<br>width=${px(width)}, height=${px(height)}`
        let commandParameters = `width=${px(width)}`;
        if (trim.left !== 0 || trim.bottom !== 0 || trim.right !== 0 || trim.top !== 0) {
            let clip = `, trim=${px(trim.left/scale)} ${px(trim.bottom/scale)} ${px(trim.right/scale)} ${px(trim.top/scale)}, clip`;
            if (clip !== ', trim=0px 0px 0px 0px, clip') { // to take rounding into account
                commandParameters += clip;
            }
        }

        // Display the command in the visualisation (for now)
        this.text.innerHTML = frame + `<br>\\includegraphics[${commandParameters}]{${this.path}}`;

        // Modify the underlying document
        const commandText = `\\includegraphics[${commandParameters}]{${this.path}}`;

        const from = parseLocationFromAttribute(this.visualisation.getAttribute("data-loc-start"));
        const to = this.lastGeneratedCommandLength >= 0
                 ? {...from, columnIndex: from.columnIndex + this.lastGeneratedCommandLength}
                 : parseLocationFromAttribute(this.visualisation.getAttribute("data-loc-end"));

        vscode.postMessage({
            type: MessageTypes.ReplaceText,
            from: from,
            to: to,
            with: commandText
        });

        this.lastGeneratedCommandLength = commandText.length;
    }
}

// Setup image frame objects for includegraphics visualisations
// function createImageFrames() {
//     const includegraphicsVisElements = visualisationsNode.querySelectorAll(`.visualisation[data-name="includegraphics"]`);
//     for (let element of includegraphicsVisElements) {
//         new ImageFrame(element);
//     }
// }

// visualisationsNode.addEventListener("visualisations-changed", event => {
//     createImageFrames();
// });

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
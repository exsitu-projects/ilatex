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
        const sourceIndex = parseInt(visualisation.getAttribute("data-source-index"));
        const annotationMaskNode = findMaskNodeWithIndex(sourceIndex);
        const naturalScale = this.img.naturalWidth / this.img.naturalHeight;
        this.initFrameScale = annotationMaskNode.clientWidth / annotationMaskNode.clientHeight;

        const pdfPageNumberStr = annotationMaskNode.getAttribute("data-page-number");
        const pdfPageNode = findPageNode(pdfPageNumberStr);
        const viewportScale = parseFloat(pdfPageNode.getAttribute("data-viewport-scale"));

        this.frameWidth = annotationMaskNode.clientWidth;
        this.frameHeight = annotationMaskNode.clientHeight;
/*
        if (this.options.width && !this.options.height) {
            this.frameWidth = this.options.width;
            this.frameHeight = this.options.width / naturalScale;
        }
        else if (!this.options.width && this.options.height) {
            this.frameWidth = this.options.height * naturalScale;
            this.frameHeight = this.options.height;
        }
        else if (this.options.width && this.options.height) {
            this.frameWidth = this.frameWidth / this.img.naturalWidth;
            this.frameHeight = this.frameHeight / this.img.naturalHeight;
        }
        else if (this.options.scale) {
            const commonScale = this.options.scale;
            this.frameWidth = commonScale;
            this.frameHeight = commonScale;
        }
*/
        this.updateFrameDimensions();

        // image transform
        this.scaleX = 1;//firstDefined(this.options.scale, 1);
        this.scaleY = 1;//firstDefined(this.options.scale, 1);
/*
        if (this.options.width && !this.options.height) {
            const commonScale = this.frameWidth / this.img.naturalWidth;
            this.scaleX = commonScale;
            this.scaleY = commonScale;
        }
        else if (!this.options.width && this.options.height) {
            const commonScale = this.frameHeight / this.img.naturalHeight;
            this.scaleX = commonScale;
            this.scaleY = commonScale;
        }
        else if (this.options.width && this.options.height) {
            this.scaleX = this.frameWidth / this.img.naturalWidth;
            this.scaleY = this.frameHeight / this.img.naturalHeight;
        }
        else if (this.options.scale) {
            const commonScale = this.options.scale;
            this.scaleX = commonScale;
            this.scaleY = commonScale;
        }
*/

        // Trim values are given in px (possibly converted from the source code)
        // and must therefore be scaled to match the size of the pixels of the rendered PDF
        // (since the PDF is scaled to fit in the canvas, they may be of different sizes)
        
        const top = firstDefined(this.options.trim.top, 0);
        const bottom = firstDefined(this.options.trim.bottom, 0);
        const left = firstDefined(this.options.trim.left, 0);
        const right = firstDefined(this.options.trim.right, 0);

        const topPercent = top / this.img.naturalHeight;
        const bottomPercent = bottom / this.img.naturalHeight;
        const leftPercent = left / this.img.naturalWidth;
        const rightPercent = right / this.img.naturalWidth;

        const croppedNaturalWidth = this.img.naturalWidth - left - right;
        const croppedNaturalHeight = this.img.naturalHeight - top - bottom;

        let horizontalScale = 1;
        let verticalScale = 1;

        if (this.options.width && !this.options.height) {
            const scaleToFitSizeParameter = this.options.width / croppedNaturalWidth;
            horizontalScale = scaleToFitSizeParameter;
            verticalScale = scaleToFitSizeParameter;
        }
        else if (!this.options.width && this.options.height) {
            const scaleToFitSizeParameter = this.options.height / croppedNaturalHeight;
            horizontalScale = scaleToFitSizeParameter;
            verticalScale = scaleToFitSizeParameter;           
        }
        else if (this.options.width && this.options.height) {
            horizontalScale = this.options.width / croppedNaturalWidth;
            verticalScale = this.options.height / croppedNaturalHeight;
        }
        else if (this.options.scale) {
            // TODO
        }

        console.log("scales");
        console.log("horiz", horizontalScale, "vert", verticalScale);

        let scaledTop = top * verticalScale;
        let scaledBottom = bottom * verticalScale;
        let scaledLeft = left * horizontalScale;
        let scaledRight = right * horizontalScale;

        console.log(
            "scaledTop", scaledTop,
            "scaledBottom", scaledBottom,
            "scaledLeft", scaledLeft,
            "scaledRight", scaledRight,
        );
        
        // const pixelRatio = this.options.width  ? (this.frameWidth / (this.options.width - left - right))
        //                  : this.options.height ? (this.frameHeight / (this.options.height - top - bottom))
        //                  : (this.frameWidth / (this.img.naturalWidth - left - right));

        const pixelRatio = viewportScale;

        this.scaleX = 1;//((top + this.frameWidth + bottom) / this.frameWidth);
        this.scaleY = 1;//((left + this.frameHeight + right) / this.frameHeight);

        this.offsetX = -scaledLeft * pixelRatio;//-leftPercent * this.frameWidth;// * pixelRatio;
        this.offsetY = -scaledTop * pixelRatio;//-topPercent * this.frameWidth;// * pixelRatio;

        //this.imageWidth = this.img.naturalWidth;
        //this.imageHeight = this.img.naturalHeight;

        // TODO: handle cases where both width and height are specified?
        // i.e. if the aspect ratio is broken, this will not hold true
        //const horizontalScale = ((left + this.frameWidth + right) / this.frameWidth);
        //const verticalScale = ((top + this.frameHeight + bottom) / this.frameHeight);
        //const imageDimScale = Math.max(horizontalScale, verticalScale);

        this.imageWidth = ((scaledLeft + scaledRight) * pixelRatio) + this.frameWidth;// * pixelRatio;
        this.imageHeight = ((scaledTop + scaledBottom) * pixelRatio) + this.frameHeight;// * pixelRatio;

        // if (this.options.width && !this.options.height) {
        //     this.imageWidth *= horizontalScale;
        //     this.imageHeight *= horizontalScale;
        // }
        // else if (!this.options.width && this.options.height) {
        //     this.imageWidth *= verticalScale;
        //     this.imageHeight *= verticalScale;
        // }
        // else if (this.options.width && this.options.height) {
        //     this.imageWidth *= horizontalScale;
        //     this.imageHeight *= verticalScale;
        // }

        //this.imageWidth *= imageDimScale;
        //this.imageHeight *= imageDimScale;

        console.log("Image " + this.img.src);
        console.log("options", this.options);
        console.log(this);

        console.log("img width and height");
        console.log("frm", this.frameWidth, this.frameHeight, "img", this.imageWidth, this.imageHeight);
        console.log("pixel ratio: ", pixelRatio);


        this.updateImagesDimensions();
        this.updateImagesPositions();

        
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
        const newImageWidth = this.imageWidth * this.scaleX;
        const newImageHeight = this.imageHeight * this.scaleY;

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

            let newScaleX = this.scaleX * ds;
            let newScaleY = this.scaleY * ds;
            if (newScaleX > 0.1 && newScaleY > 0.1) {
                // Update the scale of the images
                this.scaleX = newScaleX;
                this.scaleY = newScaleY;

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
        let scaleX = this.scaleX;
        let scaleY = this.scaleY;

        let width = this.frameWidth;
        let height = this.frameHeight;
        let right = this.offsetX + this.imageWidth*scaleX;
        let bottom = this.offsetY + this.imageHeight*scaleY;

        if (this.offsetX > this.frameWidth || this.offsetY > this.frameHeight || right < 0 || bottom < 0) {
            //this.text.innerHTML = frame + ' image out of bounds';
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
        let commandParameters = `width=${px(width)}, height=${px(height)}`;
        if (trim.left !== 0 || trim.bottom !== 0 || trim.right !== 0 || trim.top !== 0) {
            console.log("before clip");
            console.log(trim);
            console.log((trim.left / this.imageWidth), (trim.left / this.imageWidth) * this.img.naturalWidth / scaleX);
            //console.log(trim.bottom, bottom, this.frameHeight, this.imageHeight);

            const left = px((trim.left / this.imageWidth) * this.img.naturalWidth / scaleX);
            const bottom = px((trim.bottom / this.imageHeight) * this.img.naturalHeight / scaleY);
            const right = px((trim.right / this.imageWidth) * this.img.naturalWidth / scaleX);
            const top = px((trim.top / this.imageHeight) * this.img.naturalHeight / scaleY);
            let clip = `, trim=${left} ${bottom} ${right} ${top}, clip`;

            //let clip = `, trim=${px(trim.left/scaleX)} ${px(trim.bottom/scaleY)} ${px(trim.right/scaleX)} ${px(trim.top/scaleY)}, clip`;
            if (clip !== ', trim=0px 0px 0px 0px, clip') { // to take rounding into account
                commandParameters += clip;
            }
        }

        // Display the command in the visualisation (for now)
        //this.text.innerHTML = frame + `<br>\\includegraphics[${commandParameters}]{${this.path}}`;

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
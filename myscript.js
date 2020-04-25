/**
 * Uses Delaunay triangulation to divide a rectangle into triangles.
 */
class Triangulator {
    constructor(size, points) {
        this.size = size;
        this.points = points || [];
    }
    
    getEffectivePoints() {
        const { w, h } = this.size,
              corners = [
                  Triangulator.createPoint([0,0]),
                  Triangulator.createPoint([w,0]),
                  Triangulator.createPoint([0,h]),
                  Triangulator.createPoint([w,h]),
              ];
        return corners.concat(this.points.filter(p => !p.toDelete));
    }

    getTriangles(indexes) {
        const coords = this.getEffectivePoints().map(p => p.coord),
              triangles = Delaunay.triangulate(coords),
              trisList = [];

        //"...it will return you a giant array, arranged in triplets, 
        //    representing triangles by indices into the passed array."
        let a, b, c;
        for(let i = 0; i < triangles.length; i += 3) {
            a = triangles[i];
            b = triangles[i+1];
            c = triangles[i+2];
            trisList.push( indexes ? [a, b, c] : [coords[a], coords[b], coords[c]] );
        }
        return trisList;
    }

    getEdges() {
        const drawn = {},
              edges = [];

        function addIfNew(p1, p2) {
            var key = (p1 < p2) ? (p1 + '_' + p2) : (p2 + '_' + p1);
            if(drawn[key]) { return; }
            drawn[key] = true;

            edges.push([p1, p2]);
        }

        this.getTriangles().forEach(t => {
            addIfNew(t[0], t[1]);
            addIfNew(t[1], t[2]);
            addIfNew(t[2], t[0]);
        });
        return edges;
    }

    addPoint(coord) {
        this.points.push(Triangulator.createPoint(coord));
    }
    
    static createPoint(coord) {
        return {
            coord: coord.map(Math.round),
            //toDelete: false,
        }
    }
}


/**
 * Renders an image on a canvas, within a maximum bounding box.
 */
class ImageRenderer {
    constructor(canvas, onImgLoad) {
        this.canvas = canvas;
        const img = this.image = new Image();

        img.addEventListener('load', e => {
            const w = img.naturalWidth,
                  h = img.naturalHeight,
                  aspect = w/h;

            this.info = {
                width: w,
                height: h,
                aspect,
            };
            onImgLoad(this);
        }, false);
    }
    
    setSrc(src) {
        this.image.src = src;
    }
    
    clampSize(maxW, maxH) {
        const info = this.info;
        if(!info) { throw new Error(`No size info yet (${this.image.src})`); }
        
        const w = info.width,
              h = info.height,
              shrinkageW = maxW / w,
              shrinkageH = maxH / h,
              shrinkage  = Math.min(shrinkageW, shrinkageH),
              clamped = (shrinkage < 1) ? [w * shrinkage, h * shrinkage] : [w, h];

        return clamped;
    }
    
    render(canvSize) {
        const canvas = this.canvas;
        if(canvSize) {
            canvas.width  = canvSize[0];
            canvas.height = canvSize[1];
        }

        const w = canvas.width,
              h = canvas.height,
              [imgW, imgH] = this.clampSize(w, h),
              padW = (w - imgW) / 2,
              padH = (h - imgH) / 2;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.image, padW, padH, imgW, imgH);
    }
}


/**
 * Draws a warped image on a canvas by comparing a normal and a warped triangulation.
 */
function warpImage(img, triSource, triTarget, canvas, lerpT) {
    const um = ABOUtils.Math,
          uc = ABOUtils.Canvas,
          ug = ABOUtils.Geom;

    function drawTriangle(s1, s2, s3, d1, d2, d3) {
        //TODO: Expand dest ~.5, and source similarly based on area difference..
        //Overlap the destination areas a little
        //to avoid hairline cracks when drawing mulitiple connected triangles.
        const [d1x, d2x, d3x] = [d1, d2, d3], //ug.expandTriangle(d1, d2, d3, .3),
              [s1x, s2x, s3x] = [s1, s2, s3]; //ug.expandTriangle(s1, s2, s3, .3);

        uc.drawImageTriangle(img, ctx,
                             s1x, s2x, s3x,
                             d1x, d2x, d3x, true);
    }

    const { w, h } = triTarget.size,
          ctx = canvas.getContext('2d'),
          tri1 = triSource.getTriangles(true),
          tri2 = triTarget.getTriangles(true),
          co1 = triSource.getEffectivePoints().map(p => p.coord);

    let co2 = triTarget.getEffectivePoints().map(p => p.coord);
    if(lerpT || (lerpT === 0)) {
        co2 = um.lerp(co1, co2, lerpT);
    }

    ctx.clearRect(0,0, w,h);
    tri1.forEach((t1, i) => {
        const corners1 = t1.map(i => co1[i]),
              corners2 = t1.map(i => co2[i]);

        drawTriangle(corners1[0], corners1[1], corners1[2],
                     corners2[0], corners2[1], corners2[2]);
    });
}


(function() {
    "use strict";
    console.clear();

    const um = ABOUtils.Math,
          ud = ABOUtils.DOM,
          [$, $$] = ud.selectors();


    let _loader1, _loader2;
    
    const _srcA = 'data:image/jpeg;base64,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',
          _srcB = 'data:image/jpeg;base64,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',
          _size = {
              w: 400,
              h: 400,
          },
          _maxSize = 500,
          //Global state model. Can be changed from within Vue or from the outside.
          _state = {
              size: _size,
              tri1: new Triangulator(_size, [{"coord":[53,77]},{"coord":[106,35]},{"coord":[152,38]},{"coord":[238,56]},{"coord":[282,67]},{"coord":[312,123]},{"coord":[271,122]},{"coord":[251,155]},{"coord":[211,276]},{"coord":[216,318]},{"coord":[191,403]},{"coord":[153,459]},{"coord":[92,90]},{"coord":[101,117]},{"coord":[78,211]},{"coord":[56,222]},{"coord":[0,302]},{"coord":[143,95]},{"coord":[229,111]},{"coord":[175,169]},{"coord":[115,158]},{"coord":[118,212]},{"coord":[207,225]},{"coord":[229,177]},{"coord":[59,113]},{"coord":[287,157]},{"coord":[87,153]},{"coord":[247,188]},{"coord":[86,247]},{"coord":[177,324]},{"coord":[122,384]},{"coord":[80,459]},{"coord":[139,110]},{"coord":[228,125]}]),
              tri2: new Triangulator(_size, [{"coord":[99,13]},{"coord":[129,35]},{"coord":[156,69]},{"coord":[222,73]},{"coord":[261,33]},{"coord":[287,31]},{"coord":[274,107]},{"coord":[264,146]},{"coord":[182,263]},{"coord":[180,306]},{"coord":[120,385]},{"coord":[68,459]},{"coord":[99,87]},{"coord":[98,119]},{"coord":[78,135]},{"coord":[44,142]},{"coord":[0,150]},{"coord":[150,127]},{"coord":[211,131]},{"coord":[175,169]},{"coord":[135,167]},{"coord":[136,195]},{"coord":[210,200]},{"coord":[220,171]},{"coord":[91,37]},{"coord":[288,64]},{"coord":[91,126]},{"coord":[246,188]},{"coord":[97,181]},{"coord":[150,248]},{"coord":[94,307]},{"coord":[51,459]},{"coord":[135,137]},{"coord":[223,142]}]),
              selectedIndex: -1,
          };

    
    Vue.component('triangulator', {
        template: `
<svg :width="size.w" :height="size.h" @click="addPoint">
    <g class="edges">
        <connector class="edge"   v-for="(e, i) in edges"   :start="e[0]" :end="e[1]"></connector>
    </g>
    <g class="nodes">
        <drag-node class="point"  v-for="(p, i) in points"  v-model="p.coord" :class="{ selected: (i === selectedIndex) }" :r="10" :data-index="i"></drag-node>
    </g>
</svg>`,
        props: ['model', 'selectedIndex'],
        computed: {
            size()   { return this.model.size; },
            points() { return this.model.points; },
            edges()  { return this.model.getEdges(); },
        },
        mounted() {
            const that = this,
                  svg = this.$el,
                  deleteThreshold = 20;

            function findPointIndex(node) {
                const index = parseInt(node.dataset.index);
                return index;
            }

            dragTracker({
                container: svg, 
                selector: '[data-draggable]',
                propagateEvents: true,
                //dragOutside: false,
                callback: (node, pos) => {
                    const x = pos[0],
                          y = pos[1],
                          point = that.points[findPointIndex(node)];

                    let normPos;
                    //Drag a point above the canvas to delete:
                    if(y < -deleteThreshold) {
                        point.toDelete = true;
                        normPos = pos;
                    }
                    else {
                        const w = that.size.w,
                              h = that.size.h;
                        normPos = [um.clamp(x, 0, w), um.clamp(y, 0, h)];
                    }

                    //const event = new CustomEvent('dragging', { detail: { pos: nodePos } });
                    const event = document.createEvent('CustomEvent');
                    event.initCustomEvent('dragging', true, false, { pos: normPos } );
                    node.dispatchEvent(event);
                },
                callbackDragStart: (node, pos) => {
                    that.select(findPointIndex(node));
                },
                callbackDragEnd: (node, pos) => {
                    const point = that.points[findPointIndex(node)];
                    if(point.toDelete) {
                        that.deletePoint(findPointIndex(node))
                    }
                },
            });
        },
        methods: {
            addPoint(e) {
                const svg = e.currentTarget;
                if(e.target !== svg) { return; }

                const coord = ud.relativeMousePos(e, svg);
                this.model.addPoint(coord);

                this.$emit('added');
                this.select(this.model.points.length - 1);
            },
            select(index) {
                this.$emit('selected', index);
            },
            deletePoint(index) {
                this.$emit('deleted', index);
            },
        },
    });


    new Vue({
        el: '#app',
        data: {
            state: _state,
            morphAnim: null,
        },
        mounted() {
            console.log('main mounted');

            //Handle rendering of the "before" and "after" images.
            function onLoad(loader) {
                const info1 = _loader1.info,
                      info2 = _loader2.info;

                //Once we have two images loaded, render both with the same size:
                let size;
                if(info1 && info2) {
                    size = _loader1.clampSize(_maxSize, _maxSize);
                    _loader1.render(size);
                    _loader2.render(size);
                }
                //Render the very first image while we wait for a second one:
                else {
                    size = loader.clampSize(_maxSize, _maxSize);
                    loader.render(size);
                }

                _size.w = size[0];
                _size.h = size[1];
            }

            [_loader1, _loader2] = $$('.image-container').map(container => {
                const canvas = $('.img', container),
                      input = $('input', container),
                      loader = new ImageRenderer(canvas, onLoad);

                const onChange = (file) => {
                    loader.setSrc(file.url);
                    this.stopAnim();
                }
                ud.dropImage(container, onChange);
                ud.dropImage(input, onChange);

                return loader;
            });

            _loader1.setSrc(_srcA);
            _loader2.setSrc(_srcB);
        },
        methods: {
            sizer() {
                const obj = {
                    width:  _size.w + 'px',
                    height: _size.h + 'px',
                };
                return obj;
            },
            clear() {
                this.state.tri1.points = [];
                this.state.tri2.points = [];
            },
            stopAnim() {
                if(this.morphAnim) { this.morphAnim.cancel(); }
            },
            warp() {
                const c1 = $('#c1'),
                      c2 = $('#c2');
                
                let skip = false;
                function frame(t) {
                    //30fps is more than enough:
                    skip = !skip;
                    if(skip) { return; }
                    
                    warpImage(_loader1.canvas, _state.tri1, _state.tri2, c1, t);
                    warpImage(_loader2.canvas, _state.tri2, _state.tri1, c2, (1-t));
                    c2.style.opacity = t;
                }

                this.stopAnim();
                this.morphAnim = ud.animate(3000, frame, true);
            },

            //Sync added, selected and deleted points between the two lists:
            onAdded() {
                const a = this.state.tri1,
                      b = this.state.tri2,
                      [source, target] = (a.points.length > b.points.length) ? [a, b] : [b, a],
                      [sourcePoints, targetPoints] = [source.points, target.points];

                while(targetPoints.length < sourcePoints.length) {
                    target.addPoint(sourcePoints[targetPoints.length].coord);
                }
            },
            onSelected(index) {
                this.stopAnim();
                this.state.selectedIndex = index;
            },
            onDeleted(index) {
                this.$delete(this.state.tri1.points, index);
                this.$delete(this.state.tri2.points, index);
            },
        },
        filters: {
            prettyCompact: function(obj) {
                return 'tri1: new Triangulator(_size, ' + JSON.stringify(obj.tri1.points) + '),\n' +
                       'tri2: new Triangulator(_size, ' + JSON.stringify(obj.tri2.points) + '),\n\n';
                
                if(!obj) return '';
                const pretty = JSON.stringify(obj, null, 2),
                      //Collapse simple arrays (arrays without objects or nested arrays) to one line:
                      compact = pretty.replace(/\[[^[{]*?]/g, (match => match.replace(/\s+/g, ' ')))

                return compact;
            }
        },
    });

})();
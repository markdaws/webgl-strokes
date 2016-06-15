/**
* Represents a field of vectors
* @param {number} width - the width of the vector field in world units
* @param {number} height - the height of the vector field in world units
* @param {number} rows - the number of rows of vectors
* @param {number} columns - the number of columns of vectors
*/
function VectorField(width, height, rows, columns) {
    this.width = width;
    this.height = height;
    this.rows = rows;
    this.columns = columns;
    this.forces = [];
    this.position = new THREE.Vector3(0,0,0);
}
VectorField.ZERO = new THREE.Vector3(0,0,0);

VectorField.prototype = {
    init: function() {
        noise.seed(Math.random());

        var dc = this.width / this.columns;
        var dr = this.height / this.rows;
        var hdc = dc / 2;
        var hdr = dr / 2;
        var halfW = this.width / 2;
        var halfH = this.height / 2;
        for (var r = 0; r<this.rows;++r) {
            this.forces[r] = [];
            for (var c = 0; c<this.columns;++c) {
                var fx = noise.simplex2(r, c);// * 0.01;
                var fy = noise.simplex2(r  + 100, c  + 100);// * 0.01;

                var force = new THREE.Vector3(fx, fy, 0.0);//.normalize();
                //this.forces[r][c] = force;
//                debugger;
                var deltaX = (c+1) * dc - hdc - halfW;
                //r == 0 ? console.log(c + ' : ' + deltaX + ' : ' + halfW + ' : ' + ((c+1)*hdc)) : '';
                var deltaY = (r+1) * dr - hdr - halfH;
                var cv = new THREE.Vector3(-deltaY, deltaX, 0);
                cv.normalize();
                cv.multiplyScalar(0.01);
                this.forces[r][c] = cv;

                this.forces[r][c] = new THREE.Vector3(1,0,0);
            }
        }
    },

    /**
    * Returns the force at location x,y
     * @param {THREE.Vector3} position - world space position
    */
    getForce: function(position) {
        var dc = this.width / this.columns;
        var dr = this.height / this.rows;

        var localX = position.x - this.position.x;
        var localY = position.y - this.position.y;

        var c = Math.floor(localX / dc);
        var r = Math.floor(localY / dr);

        if (r < 0 || c < 0 || r >= this.rows || c >= this.columns) {
            return VectorField.ZERO;
        }

        return this.forces[r][c];
    },

    /**
     * @param {number} left - Left bound extreme in world coords
     * @param (number top - Top bound extreme in world coords
     */
    getBounds: function(left, top, width, height) {
        var dc = this.width / this.columns;
        var dr = this.height / this.rows;

        var localX = left - this.position.x;
        var localY = top - this.position.y;

        var c = Math.floor(localX / dc);
        var r = Math.floor(localY / dr);

        var numR = Math.ceil(height / (this.height / this.columns));
        var numC = Math.ceil(width / (this.width / this.rows));

        return {
            top: r,
            left: c,
            rows: numR,
            columns: numC
        };
    },

    setForce: function(row, column, force) {
        this.forces[row][column] = force;
    },

    applyBrush: function(position, brush) {
        brush.apply(this, position);
    }
};

function CircleBrush(radius, force) {
    this.radius = radius;
    this.force = force;
}
CircleBrush.prototype = {
    apply: function(vectorField, position) {
        var left = position.x - this.radius;
        var top = position.y + this.radius;

        var bounds = vectorField.getBounds(left, top, this.radius * 2, this.radius * 2);
        console.log(bounds);
        var dc = vectorField.width / vectorField.columns;
        var dr = vectorField.height / vectorField.rows;
        var hdc = dc / 2;
        var hdr = dr / 2;
        var halfW = vectorField.width / 2;
        var halfH = vectorField.height / 2;
        for (var r = bounds.top-bounds.rows; r<bounds.top;++r) {
            for (var c = bounds.left; c<bounds.left+bounds.columns;++c) {
                var deltaX = (c+1) * dc - hdc - halfW;
                var deltaY = (r+1) * dr - hdr - halfH;
                var cv = new THREE.Vector3(-deltaY, deltaX, 0);
                console.log(deltaX + ' : ' + deltaY);
                cv.normalize();
                cv.multiplyScalar(this.force);

                console.log(r + ' : ' + c);
                vectorField.setForce(r, c, cv);
            }
        }
    }
};

/**
* Visualizes the vector field
*/
function VectorFieldVisualizer(vectorField) {
    this.vectorField = vectorField;
}
VectorFieldVisualizer.prototype = {
    /**
     * @returns {THREE.Scene} A scene containing all of the vector meshes
    */
    scene: function() {
        var scene = new THREE.Scene();

        var dc = this.vectorField.width / this.vectorField.columns;
        var dr = this.vectorField.height / this.vectorField.rows;
        var halfDc = dc / 2;
        var halfDr = dr / 2;

        var pos;

        var numCell = this.vectorField.columns * this.vectorField.rows * 6;
        var positions = new Float32Array(numCell);
        var indices = [];
        var index = 0;
        var i = 0;
        for (var x=0; x<this.vectorField.width; x+=dc) {
            for (var y=0; y<this.vectorField.height; y+=dr) {
                pos = new THREE.Vector3(
                    x + this.vectorField.position.x,
                    y + this.vectorField.position.y,
                    0);
                var dir = this.vectorField.getForce(pos).clone().normalize();
                var origin = new THREE.Vector3(x + halfDc, y + halfDr, 0 );
                var length = Math.min(halfDc, halfDr);//dir.length();
                var hex = 0xffff00;

                positions[i++] = origin.x;
                positions[i++] = origin.y;
                positions[i++] = origin.z;
                positions[i++] = origin.x + dir.x * length;
                positions[i++] = origin.y + dir.y * length;
                positions[i++] = origin.z + dir.z * length;

                indices.push(index++);
                indices.push(index++);
                //var arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
                //scene.add(arrowHelper);
            }
        }

        var geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));

        var line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
            color: 0xffff00
        }));
        scene.add(line);

        pos = this.vectorField.position;
        scene.position.set(pos.x, pos.y, pos.z);
        return scene;
    },

    update: function() {
    }
};

function StrokeSystem(vectorField) {
    this.vectorField = vectorField;
    this.strokes = [];
}
StrokeSystem.prototype = {
    init: function(scene) {
        this.scene = scene;
        return;
        for (var i=0; i<20; ++i) {
            var stroke = new Stroke();
            this.strokes[i] = stroke;
            scene.add(stroke.mesh());

            stroke.position.x = -50 + Math.random() * 100;
            stroke.position.y = -50 + Math.random() * 100;
        }
    },

    update: function(appTime) {
        var stroke = new Stroke();
        stroke.position.x = -50 + Math.random() * 100;
        stroke.position.y = -50 + Math.random() * 100;
        this.scene.add(stroke.mesh());
        this.strokes.push(stroke);

        for (var i=this.strokes.length-1; i>0; --i) {
            var stroke = this.strokes[i];
            stroke.applyForce(this.vectorField.getForce(stroke.position));
            var expired = stroke.update(appTime);
            if (expired) {
                this.strokes.splice(i, 1);
                this.scene.remove(stroke.mesh());
            }
        }
    }
};

function Stroke() {
    this.velocity = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.mass = 0.1;
    this.acceleration = new THREE.Vector3();
    this.lifespan = 5 * 1000;
    this.born = -1;
}
Stroke.prototype = {
    mesh: function() {
        if (!this._mesh) {
            var sphere = new THREE.SphereGeometry(15, 8, 8);
            var sphereMesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({
                color: 0xff0000
            }));
            sphereMesh.material.wireframe = true;
            this._mesh = sphereMesh;
        }
        return this._mesh;
    },

    update: function(appTime) {
        if (this.born === -1) {
            this.born = appTime;
        }
        this.expired = (appTime - this.born) > this.lifespan;
        if (this.expired) {
            this._mesh.visible = false;
            return true;
        }
        this.velocity.add(this.acceleration);
        this.position.add(this.velocity);
        this.acceleration.multiplyScalar(0);

//        console.log(this._mesh.position);
        this._mesh.position.set(this.position.x, this.position.y, this.position.z);
        return false;
    },

    applyForce: function(v) {
        //a = f/m
        this.acceleration.addScaledVector(v, 1.0 / this.mass);
    }
};

(function() {
    var stats = new Stats();
    //FPS - panel 0
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    var renderer = new THREE.WebGLRenderer();
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    var scene, camera;
    var geom = new THREE.PlaneGeometry(10,10,1,1);
    var material = new THREE.MeshBasicMaterial({
        color: 0xff0000
    });

    var vert = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

    var frag = `
uniform sampler2D tex;
varying vec2 vUv;

void main() {
  gl_FragColor = vec4(1.0,0.0,0.0,1.0);
}
`;

    material = new THREE.ShaderMaterial({
        uniforms: {
            tex: {}
        },
        fragmentShader: frag,
        vertexShader: vert
    });
    var mesh = new THREE.Mesh(geom, material);

    new THREE.TextureLoader().load(
        './rock_colormap.bmp',
        function(texture) {
            material.uniforms.tex.value = texture;
        },
        function(p) {
            console.log('progress');
        },
        function(err) {
            console.log(err);
        }
    );

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 500);
    camera.position.z = 100;

    var height = 2000;
    var width = height * window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 500);
    camera.position.z = 100;

    var controls = new THREE.OrbitControls(camera);

    var vectorField = new VectorField(width, height, 50,50);
    vectorField.position = new THREE.Vector3(width / -2, height / -2, 0);
    //vectorField.position = new THREE.Vector3(0,0,0);
    vectorField.init();

    var vfVisualizer = new VectorFieldVisualizer(vectorField);

    var brush = new CircleBrush(250, 0.01);
    vectorField.applyBrush(new THREE.Vector3(0,0,0), brush);

    brush.force = 1;
    vectorField.applyBrush(new THREE.Vector3(300, -300, 0), brush);

    scene = new THREE.Scene();
    scene.add(vfVisualizer.scene());

    
    var strokeSystem = new StrokeSystem(vectorField);
    strokeSystem.init(scene);

    function render() {
        stats.begin();

        strokeSystem.update(performance.now());
        renderer.render(scene, camera);

        stats.end();
        requestAnimationFrame(render);
    }
    render();
})();

function getSync(url)
{
  var val = null;

  $.ajax({
    'async': false,
    'global': false,
    'url': url,
    'success': function(data) {
      val = data;
    }
  });

  return val;
};


// From <http://stackoverflow.com/a/7183523>
function rawStringToBuffer(str, offset, length)
{
  if (offset == undefined)
  {
    var offset = 0;
  }

  if (length == undefined)
  {
    var length = str.length;
  }
  else
  {
    if (length > str.length)
    {
      var length = str.length;
    }
  }

  var arr = new Array(length);
  var idx;
  for (idx = offset; idx < length + offset; ++idx) 
  {
    arr[idx - offset] = str.charCodeAt(idx) & 0xFF;
  }
  // You may create an ArrayBuffer from a standard array (of values) as follows:
  return new Uint8Array(arr).buffer;
}


var gl = null;
var vertexBuffer = null;
var indexBuffer = null;
var shaderProgram = null;

function initGL(canvas) 
{
  var gl = WebGLUtils.setupWebGL(canvas[0]);
  if (gl)
  {
    gl.viewportWidth = canvas.width();
    gl.viewportHeight = canvas.height();
  }

  return gl
}


function getShader(gl, shader_code, type) 
{
  var shader;
  if (type == "fragment") 
  {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } 
  else if (type == "vertex") 
  {
    shader = gl.createShader(gl.VERTEX_SHADER);
  }
  else
  {
    throw new Error("Unknown shader type: " + String(type));
  }

  gl.shaderSource(shader, shader_code);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
  {
    throw new Error(gl.getShaderInfoLog(shader));
  }

  return shader;
}


function loadShaders(gl, vertex_code, fragment_code) 
{
  var vertexShader = getShader(gl, vertex_code, "vertex");
  var fragmentShader = getShader(gl, fragment_code, "fragment");

  // Shader program.
  // TODO: Remove old program if exists.
  var sp = gl.createProgram();
  gl.attachShader(sp, vertexShader);
  gl.attachShader(sp, fragmentShader);
  gl.linkProgram(sp);

  if (!gl.getProgramParameter(sp, gl.LINK_STATUS))
  {
    throw new Error("Failed to create shader program");
  }

  gl.useProgram(sp);

  sp.vertexPositionAttribute = 
      gl.getAttribLocation(sp, "aVertexPosition");
  gl.enableVertexAttribArray(sp.vertexPositionAttribute);

  sp.vertexNormalAttribute = 
      gl.getAttribLocation(sp, "aVertexNormal");
  gl.enableVertexAttribArray(sp.vertexNormalAttribute);

  sp.textureCoordAttribute = 
      gl.getAttribLocation(sp, "aTextureCoord");
  gl.enableVertexAttribArray(sp.textureCoordAttribute);

  sp.pMatrixUniform = 
      gl.getUniformLocation(sp, "uPMatrix");
  sp.mvMatrixUniform = 
      gl.getUniformLocation(sp, "uMVMatrix");
  sp.nMatrixUniform = 
      gl.getUniformLocation(sp, "uNMatrix");
  sp.samplerUniform = 
      gl.getUniformLocation(sp, "uSampler");
  sp.materialShininessUniform = 
      gl.getUniformLocation(sp, "uMaterialShininess");
  sp.showSpecularHighlightsUniform = 
      gl.getUniformLocation(sp, "uShowSpecularHighlights");
  sp.useTexturesUniform = 
      gl.getUniformLocation(sp, "uUseTextures");
  sp.useLightingUniform = 
      gl.getUniformLocation(sp, "uUseLighting");
  sp.ambientColorUniform = 
      gl.getUniformLocation(sp, "uAmbientColor");
  sp.pointLightingLocationUniform = 
      gl.getUniformLocation(sp, "uPointLightingLocation");
  sp.pointLightingSpecularColorUniform = 
      gl.getUniformLocation(sp, "uPointLightingSpecularColor");
  sp.pointLightingDiffuseColorUniform = 
      gl.getUniformLocation(sp, "uPointLightingDiffuseColor");

  return sp;
}


var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

function mvPushMatrix() 
{
  var copy = mat4.create();
  mat4.set(mvMatrix, copy);
  mvMatrixStack.push(copy);
}

function mvPopMatrix() 
{
  if (mvMatrixStack.length == 0) 
  {
    throw "Invalid popMatrix!";
  }
  mvMatrix = mvMatrixStack.pop();
}

function setMatrixUniforms()
{
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);

  var normalMatrix = mat3.create();
  mat4.toInverseMat3(mvMatrix, normalMatrix);
  mat3.transpose(normalMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
}

function degToRad(degrees)
{
  return degrees * Math.PI / 180;
}


function loadGeometry(gl, c2g_file)
{
  tmpBuffer = rawStringToBuffer(c2g_file, 2, 18);
  buffer = rawStringToBuffer(c2g_file);

  var numVertices = Uint32Array(tmpBuffer, 8, 1)[0];
  console.log(numVertices);
  var numIndices = Uint32Array(buffer, 16, 1)[0];
  console.log(numIndices);

  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, 
      new Float32Array(buffer, 20, numVertices), 
      gl.STATIC_DRAW);
  vertexBuffer.itemSize = 6;
  vertexBuffer.numItems = numVertices;

  indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 
      new Uint16Array(buffer, 20 + 6 * 4 * numVertices, numIndices), 
      gl.STATIC_DRAW);
  indexBuffer.itemSize = 1;
  indexBuffer.numItems = numIndices;

  return [vertexBuffer, indexBuffer]
}


function drawScene(gl, vertexBuffer, indexBuffer)
{
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

  mat4.identity(mvMatrix);

  mat4.translate(mvMatrix, [0, 0, -40]);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 
      vertexBuffer.itemSize, gl.FLOAT, false, 6, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 
      vertexBuffer.itemSize, gl.FLOAT, false, 6, 3);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  setMatrixUniforms();
  gl.drawElements(gl.TRIANGLES, indexBuffer.numItems / 3, 
      gl.UNSIGNED_SHORT, 0);
}


function tick(gl, vertexBuffer, indexBuffer)
{
  requestAnimFrame(function() { 
    tick(gl, vertexBuffer, indexBuffer); 
  });

  drawScene(gl, vertexBuffer, indexBuffer);
}


function reloadData()
{
  if (!gl)
    return;

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  //try
  {
    shaderProgram = loadShaders(gl, 
        $("#vertex-shader").val(), 
        $("#fragment-shader").val());
  }
  /*catch (e)
  {
    alert(e.message);
    //return;
    throw e;
  }*/

  //try
  {
    var c2g_file = $.base64.decode($("#c2g-base64").val().split('\n').join(''));
    var geom = loadGeometry(gl, c2g_file);
  }
  /*catch (e)
  {
    alert(e.message);
    //return;
    throw e;
  }*/

  var vertexBuffer = geom[0];
  var indexBuffer = geom[1];

  cancelRequestAnimFrame();

  if (vertexBuffer == null || indexBuffer == null)
  {
    return;
  }

  tick(gl, vertexBuffer, indexBuffer);
}

function webGLStart()
{
  // Initialize WebGL (can fail and return null).
  gl = initGL($("#canvas"));

  // Load initial data.
  $("#vertex-shader").val(
      getSync("glsl/vertex.glsl")).width("100%");
  $("#fragment-shader").val(
      getSync("glsl/fragment.glsl")).width("100%");
  $("#c2g-base64").val(
      getSync("data/monkey.c2g.txt")).width("100%");

  reloadData();
}

function main()
{
  webGLStart();
}

// vim: set sw=2 ts=2 et:

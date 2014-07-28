var gl = null;
var vertexBuffer = null;
var indexBuffer = null;
var shaderProgram = null;
var animRequest = null;
var startTime = new Date().getTime() / 1000.0;
var fpscounter = null;
var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();
var vertexShaderEditor = null;
var fragmentShaderEditor = null;


function throwOnGLError(err, funcName, args)
{
  var gl_error = WebGLDebugUtils.glEnumToString(err);
  throw new Error("WebGL Error: '" + gl_error + "' was caused by call to '" + funcName + "'");
}


function initGL(canvas) 
{
  var gl = WebGLUtils.setupWebGL(canvas[0]);
  if (gl)
  {
    gl = WebGLDebugUtils.makeDebugContext(gl, throwOnGLError);

    canvas[0].width = canvas.width();
    canvas[0].height = canvas.height();

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

  sp.vertexPositionAttribute = gl.getAttribLocation(sp, "aVertexPosition");
  if (sp.vertexPositionAttribute != -1)
    gl.enableVertexAttribArray(sp.vertexPositionAttribute);

  sp.vertexNormalAttribute = gl.getAttribLocation(sp, "aVertexNormal");
  if (sp.vertexNormalAttribute != -1)
    gl.enableVertexAttribArray(sp.vertexNormalAttribute);

  sp.textureCoordAttribute = gl.getAttribLocation(sp, "aTextureCoord");
  if (sp.textureCoordAttribute != -1)
    gl.enableVertexAttribArray(sp.textureCoordAttribute);

  sp.pMatrixUniform = gl.getUniformLocation(sp, "uPMatrix");
  sp.mvMatrixUniform = gl.getUniformLocation(sp, "uMVMatrix");
  sp.nMatrixUniform = gl.getUniformLocation(sp, "uNMatrix");
  sp.samplerUniform = gl.getUniformLocation(sp, "uSampler");

  sp.timeUniform = gl.getUniformLocation(sp, "uTime");

  return sp;
}


function setMatrixUniforms()
{
  if (shaderProgram.pMatrixUniform != -1)
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
  if (shaderProgram.mvMatrixUniform != -1)
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);

  if (shaderProgram.nMatrixUniform)
  {
    var normalMatrix = mat3.create();
    mat4.toInverseMat3(mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
  }
}


function loadUint16(buffer, offset)
{
  return new Uint16Array(buffer, offset, 1)[0];
}


function loadUint32(buffer, offset)
{
  return new Uint32Array(buffer, offset, 1)[0];
}


function loadGeometry(gl, c2g_file)
{
  var headerSize = 24;
  var floatSize = 4;
  var headerBuf = rawStringToBuffer(c2g_file, 0, headerSize);

  var numColorsPerVertex = loadUint16(headerBuf, 8);
  var numTexCoordsPerVertex = loadUint16(headerBuf, 10);
  var vertexSize = loadUint16(headerBuf, 12);
  var indexSize = loadUint16(headerBuf, 14);

  var numVertices = loadUint32(headerBuf, 16);
  var numIndices = loadUint32(headerBuf, 20);

  console.log(
    "numColorsPerVertex: " + numColorsPerVertex + "\n" +
    "numTexCoordsPerVertex: " + numTexCoordsPerVertex + "\n" +
    "vertexSize: " + vertexSize + "\n" +
    "indexSize: " + indexSize + "\n" +
    "numVertices: " + numVertices + "\n" +
    "numIndices: " + numIndices + "\n");

  var vertexFloat32Array = new Float32Array(
      rawStringToBuffer(c2g_file, 
          headerSize,
          vertexSize * numVertices));
  var indexUint16Array = new Uint16Array(
      rawStringToBuffer(c2g_file, 
          headerSize + vertexSize * numVertices,
          indexSize * numIndices));

  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, 
      vertexFloat32Array, gl.STATIC_DRAW);
  vertexBuffer.numVertices = numVertices;
  vertexBuffer.vertexSize = vertexSize;
  vertexBuffer.numColorsPerVertex = numColorsPerVertex;
  vertexBuffer.numTexCoordsPerVertex = numTexCoordsPerVertex;

  indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 
      indexUint16Array, gl.STATIC_DRAW);
  indexBuffer.numIndices = numIndices;

  console.log("Vertices: " + vertexFloat32Array.length * floatSize / vertexSize +
    ", vertices floats: " + vertexFloat32Array.length);
  console.log("Indices: " + indexUint16Array.length +
    ", indices shorts: " + indexUint16Array.length);

  return [vertexBuffer, indexBuffer];
}


function drawScene(gl, vertexBuffer, indexBuffer)
{
  fpscounter.update();

  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

  mat4.perspective(90, gl.viewportWidth / gl.viewportHeight, 
      0.1, 10.0, pMatrix);

  mat4.identity(mvMatrix);
  mat4.translate(mvMatrix, [0, 0, -2]);
  setMatrixUniforms();

  var time = new Date().getTime() / 1000.0 - startTime;
  gl.uniform1f(shaderProgram.timeUniform, time);

  if (shaderProgram.vertexPositionAttribute != -1)
  {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 
        3, gl.FLOAT, false, vertexBuffer.vertexSize, 0);
  }

  if (shaderProgram.vertexNormalAttribute != -1)
  {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 
        3, gl.FLOAT, false, vertexBuffer.vertexSize, 3);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.drawElements(gl.TRIANGLES, indexBuffer.numIndices,
      gl.UNSIGNED_SHORT, 0);
}


function tick(gl, vertexBuffer, indexBuffer)
{
  animRequest = requestAnimFrame(function() { 
    tick(gl, vertexBuffer, indexBuffer); 
  });

  drawScene(gl, vertexBuffer, indexBuffer);
}


function reloadData()
{
  if (!gl)
    return;

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);

  if (animRequest != null)
  {
    cancelRequestAnimFrame(animRequest);
    animRequest = null;
  }

  try
  {
    shaderProgram = loadShaders(gl, 
        vertexShaderEditor.getSession().getValue(), 
        fragmentShaderEditor.getSession().getValue());
  }
  catch (e)
  {
    alert(e.message);
    return;
  }

  try
  {
    var c2g_file = $.base64.decode($("#c2g-base64").val().split('\n').join(''));
    var geom = loadGeometry(gl, c2g_file);
  }
  catch (e)
  {
    alert(e.message);
    return;
  }

  var vertexBuffer = geom[0];
  var indexBuffer = geom[1];

  if (vertexBuffer == null || indexBuffer == null)
  {
    return;
  }

  tick(gl, vertexBuffer, indexBuffer);
}

function main()
{
  // Initialize WebGL (can fail and return null).
  gl = initGL($("#canvas"));

  // Load initial data.
  $("#c2g-base64").val(getSync("data/monkey.c2g.txt")).width("100%");

  var GLSLScriptMode = ace.require("ace/mode/glsl").Mode;

  vertexShaderEditor = ace.edit("vertex-shader");
  vertexShaderEditor.getSession().setMode(new GLSLScriptMode());
  vertexShaderEditor.getSession().setValue(getSync("glsl/vertex.glsl"));

  fragmentShaderEditor = ace.edit("fragment-shader");
  fragmentShaderEditor.getSession().setMode(new GLSLScriptMode());
  fragmentShaderEditor.getSession().setValue(getSync("glsl/fragment.glsl"));

  fpscounter = new FPSCounter($("#fps")[0], 50);

  $("#apply-button").click(reloadData);

  reloadData();
}

// vim: set sw=2 ts=2 et:

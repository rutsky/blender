attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

uniform float uTime;

varying vec4 vPosition;
varying vec4 vColor;

void main(void)
{
  float angle = uTime / 6.0 + 3.1415 * 2.0 / 3.0;
  mat4 rotationMatrix = mat4(
    cos(angle),  0.0, -sin(angle), 0.0,
    sin(angle),  0.0,  cos(angle), 0.0,
    0.0,         1.0,  0.0,        0.0,
    0.0,         0.0,  0.0,        1.0);

  vPosition = uMVMatrix * rotationMatrix * vec4(aVertexPosition, 1.0);
  gl_Position = uPMatrix * vPosition;
  //gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  //gl_Position = vec4(aVertexPosition, 1.0);

  vColor = vec4((aVertexPosition + vec3(1.0, 1.0, 1.0)) * 0.5, 1.0);
}

// vim: set ts=2 sw=2 et:

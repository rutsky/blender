precision mediump float;

uniform float uTime;

varying vec4 vPosition;
varying vec4 vColor;


void main(void) 
{
  //gl_FragColor = vec4(vPosition.x, vPosition.y, vPosition.z, 1.0);
  //gl_FragColor = vec4(1.0, abs(sin(10.0 * uTime)), cos(uTime), 1.0);
  gl_FragColor = vColor;
}

// vim: set ts=2 sw=2 et:

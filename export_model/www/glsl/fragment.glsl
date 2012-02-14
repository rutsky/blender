precision mediump float;

uniform float uTime;

varying vec4 vPosition;


void main(void) 
{
  //gl_FragColor = vec4(vPosition.x / 100000.0, vPosition.y / 10000.0, 0.0, 1.0);
  gl_FragColor = vec4(1.0, abs(sin(10.0 * uTime)), cos(uTime), 1.0);
}

// vim: set ts=2 sw=2 et:

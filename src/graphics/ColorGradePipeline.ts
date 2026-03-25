import Phaser from 'phaser';

const fragShader = `
precision mediump float;
uniform sampler2D uMainSampler;
varying vec2 outTexCoord;

void main() {
  vec4 color = texture2D(uMainSampler, outTexCoord);

  // Mild contrast boost (~5%)
  vec3 c = color.rgb;
  c = (c - 0.5) * 1.05 + 0.5;

  // Gentle warm midtones (reduced to preserve cool-hued zones)
  c.r = c.r * 1.02 + 0.005;
  c.g = c.g * 1.01;
  c.b = c.b * 0.98;

  // Subtle brown shadow tint: only affects very dark values
  float luminance = dot(c, vec3(0.299, 0.587, 0.114));
  float shadowMask = smoothstep(0.0, 0.25, 1.0 - luminance);
  c.r += shadowMask * 0.012;
  c.g += shadowMask * 0.003;
  c.b -= shadowMask * 0.008;

  // Clamp
  c = clamp(c, 0.0, 1.0);

  gl_FragColor = vec4(c, color.a);
}
`;

export class ColorGradePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'ColorGradePipeline',
      fragShader,
    });
  }
}

/** Register the color grade pipeline and apply to the main camera. Safe no-op on Canvas renderer. */
export function applyColorGrading(scene: Phaser.Scene): void {
  if (scene.renderer.type !== Phaser.WEBGL) return;

  const renderer = scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (!renderer.pipelines.has('ColorGradePipeline')) {
    renderer.pipelines.addPostPipeline('ColorGradePipeline', ColorGradePipeline);
  }

  scene.cameras.main.setPostPipeline(ColorGradePipeline);
}

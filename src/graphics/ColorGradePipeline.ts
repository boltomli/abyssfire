import Phaser from 'phaser';
import { getCurrentZoneMood } from './ZonePalette';

const fragShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uSat;
uniform float uContrast;
varying vec2 outTexCoord;

void main() {
  vec4 color = texture2D(uMainSampler, outTexCoord);
  vec3 c = color.rgb;

  // Per-zone saturation and contrast (gentle).
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(lum), c, uSat);
  c = (c - 0.5) * uContrast + 0.5;

  // Split toning: tint shadows (lift) and highlights (gain) with the zone mood.
  float sh = 1.0 - smoothstep(0.0, 0.55, lum);
  float hi = smoothstep(0.45, 1.0, lum);
  c += uLift * sh + uGain * hi;

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), color.a);
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

  onPreRender(): void {
    const m = getCurrentZoneMood();
    this.set3f('uLift', m.lift[0], m.lift[1], m.lift[2]);
    this.set3f('uGain', m.gain[0], m.gain[1], m.gain[2]);
    this.set1f('uSat', m.saturation);
    this.set1f('uContrast', m.contrast);
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

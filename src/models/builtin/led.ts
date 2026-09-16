import type { Component, Pin, Vec3 } from '../../types.js';
import { addMesh, cssColor } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** Typical 5 mm LED lead pitch; clamped when the authored body is smaller. */
export const LED_LEAD_PITCH_MM = 2.54;
export const LED_LEAD_SIZE_MM = 0.85;
/** Moderate metalness: this scene has no environment map, so 0.9 silver reads black. */
export const LED_LEAD_METALNESS = 0.4;

/** Bottom of the red epoxy in local Y. Metal anvils and leads live at and below this plane. */
export function ledEpoxyBottomY(heightMm: number): number {
  return -heightMm * 0.08;
}

export function ledLeadX(widthMm: number, depthMm: number, side: 'left' | 'right'): number {
  const radius = Math.min(widthMm, depthMm) / 2;
  const halfPitch = Math.min(LED_LEAD_PITCH_MM, Math.max(radius * 0.85, 1.2)) / 2;
  return side === 'left' ? -halfPitch : halfPitch;
}

/** Wire lands on the metal leg under the epoxy, not on the red body sides. */
export function ledLeadAttachY(heightMm: number): number {
  return ledEpoxyBottomY(heightMm) - 1.15;
}

export function ledLeadRole(pin: Pin): 'A' | 'K' {
  const id = pin.id.trim().toUpperCase();
  if (id === 'A' || id === 'ANODE') return 'A';
  if (id === 'K' || id === 'CATHODE') return 'K';
  return pin.side === 'left' ? 'A' : 'K';
}

export function resolveLedPinPosition(component: Component, pin: Pin): Vec3 {
  const role = ledLeadRole(pin);
  const [w, h, d] = component.dimensions;
  return [ledLeadX(w, d, role === 'A' ? 'left' : 'right'), ledLeadAttachY(h), 0];
}

function leadMetal(THREE: ThreeModule): import('three').MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#c5ccd3',
    roughness: 0.32,
    metalness: LED_LEAD_METALNESS,
  });
}

/**
 * 5 mm through-hole LED. Dome and body take component.color, default red.
 * Anode post and cathode cup sit under the epoxy on the metal leads so wires
 * attach to legs, not the red body.
 */
export function buildLed(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const radius = Math.min(w, d) / 2;
  const color = component.color ? cssColor(THREE, component.color) : new THREE.Color('#e23d28');
  const plastic = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.28,
    metalness: 0.05,
    emissive: color,
    emissiveIntensity: 0.22,
  });
  const metal = leadMetal(THREE);

  const epoxyBottom = ledEpoxyBottomY(h);
  const domeTop = h / 2;
  const domeBaseY = domeTop - radius;
  const bodyH = Math.max(domeBaseY - epoxyBottom, radius * 0.35);
  const bodyCenterY = epoxyBottom + bodyH / 2;

  const body = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius, radius, bodyH, 20),
    plastic,
    [0, bodyCenterY, 0],
  );
  body.name = 'led-body';
  meshes.push(body);

  const dome = addMesh(
    THREE,
    group,
    new THREE.SphereGeometry(radius, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    plastic,
    [0, domeBaseY, 0],
  );
  dome.name = 'led-dome';
  meshes.push(dome);

  const rimH = Math.min(0.5, bodyH * 0.18);
  const rim = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, rimH, 20),
    plastic,
    [0, epoxyBottom + rimH / 2, 0],
  );
  rim.name = 'led-rim';
  meshes.push(rim);

  // WHY: real 5 mm LEDs bury a post (A) and reflector cup (K) in the epoxy base.
  // Those pads sit under the red body and are the metal the leads hang from.
  const overlap = 0.25;
  const boxBottom = -h / 2;
  const leads: Array<{
    role: 'A' | 'K';
    x: number;
    anvil: [number, number, number];
    leadBottom: number;
  }> = [
    { role: 'A', x: ledLeadX(w, d, 'left'), anvil: [0.8, 1.25, 0.8], leadBottom: boxBottom + 0.05 },
    { role: 'K', x: ledLeadX(w, d, 'right'), anvil: [1.9, 0.95, 1.6], leadBottom: boxBottom + 1.2 },
  ];

  for (const { role, x, anvil, leadBottom } of leads) {
    const [anvilW, anvilH, anvilD] = anvil;
    const anvilY = epoxyBottom - anvilH / 2 + overlap;
    const anvilMesh = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(anvilW, anvilH, anvilD),
      metal,
      [x, anvilY, 0],
    );
    anvilMesh.name = `led-anvil:${role}`;
    anvilMesh.userData = { kind: 'led-anvil', pinId: role };
    meshes.push(anvilMesh);

    const leadTop = anvilY - anvilH / 2 + 0.18;
    const leadH = Math.max(leadTop - leadBottom, LED_LEAD_SIZE_MM);
    const leadY = (leadTop + leadBottom) / 2;
    const lead = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(LED_LEAD_SIZE_MM, leadH, LED_LEAD_SIZE_MM),
      metal,
      [x, leadY, 0],
    );
    lead.name = `led-lead:${role}`;
    lead.userData = { kind: 'led-lead', pinId: role };
    meshes.push(lead);
  }

  return { group, meshes };
}

export const ledModel: ModelDefinition = {
  kind: 'led',
  build: buildLed,
  resolvePinPosition: resolveLedPinPosition,
  hidePinMarkers: true,
};

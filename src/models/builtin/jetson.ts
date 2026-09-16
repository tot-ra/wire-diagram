import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import { addUsbA, addUsbC, USB_A_SINGLE_MM, USB_C_MM } from '../parts/usb.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** Jetson Orin Nano Super carrier: PCB, finned heatsink, and the lab I/O cluster. */
export function buildJetson(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const pcbH = Math.min(h * 0.12, 1.8);

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, pcbH, d),
    new THREE.MeshStandardMaterial({ color: '#15233a', roughness: 0.58, metalness: 0.18 }),
  );
  pcb.name = 'jetson-pcb';
  meshes.push(pcb);

  const stripe = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.92, 0.35, 3.2),
    new THREE.MeshStandardMaterial({ color: '#76b900', roughness: 0.4, metalness: 0.2 }),
    [0, pcbH / 2 + 0.2, -d / 2 + 4],
  );
  stripe.name = 'jetson-stripe';
  meshes.push(stripe);

  const sinkW = w * 0.52;
  const sinkH = Math.max(h - pcbH - 2, 8);
  const sinkD = d * 0.48;
  const sink = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(sinkW, sinkH * 0.35, sinkD),
    new THREE.MeshStandardMaterial({ color: '#c5cdd6', roughness: 0.28, metalness: 0.86 }),
    [w * 0.04, pcbH / 2 + sinkH * 0.18, 0],
  );
  sink.name = 'jetson-heatsink';
  meshes.push(sink);

  const finCount = 8;
  const finW = sinkW * 0.9;
  const finH = sinkH * 0.55;
  const finT = Math.max(sinkD / (finCount * 2.4), 0.7);
  for (let i = 0; i < finCount; i += 1) {
    const z = -sinkD / 2 + (i + 0.5) * (sinkD / finCount);
    const fin = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(finW, finH, finT),
      new THREE.MeshStandardMaterial({ color: '#d7dee6', roughness: 0.32, metalness: 0.82 }),
      [w * 0.04, pcbH / 2 + sinkH * 0.35 + finH / 2, z],
    );
    fin.name = 'jetson-fin';
    meshes.push(fin);
  }

  const fan = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(Math.min(sinkW, sinkD) * 0.22, Math.min(sinkW, sinkD) * 0.22, 2.2, 20),
    new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.55, metalness: 0.3 }),
    [w * 0.04, pcbH / 2 + sinkH * 0.35 + finH + 1.2, 0],
  );
  fan.name = 'jetson-fan';
  meshes.push(fan);

  const portY = 1.6;
  const portZ = (offset: number): number => offset;
  addUsbC(THREE, group, meshes, {
    position: [-w / 2 + USB_C_MM.depth / 2, portY, portZ(28)],
    facing: '-x',
    namePrefix: 'jetson-usbc',
  });
  addUsbA(THREE, group, meshes, {
    position: [-w / 2 + USB_A_SINGLE_MM.depth / 2, portY + 0.5, portZ(10)],
    facing: '-x',
    generation: 3,
    namePrefix: 'jetson-usba',
  });

  const hdmi = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(10, 3.6, 14),
    new THREE.MeshStandardMaterial({ color: '#8d6e2f', roughness: 0.4, metalness: 0.55 }),
    [-w / 2 + 5, portY, portZ(-8)],
  );
  hdmi.name = 'jetson-hdmi';
  meshes.push(hdmi);

  const rj45 = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(14, 8, 16),
    new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.45, metalness: 0.35 }),
    [-w / 2 + 7, 3.2, portZ(-28)],
  );
  rj45.name = 'jetson-rj45';
  meshes.push(rj45);

  return { group, meshes };
}

export const jetsonModel: ModelDefinition = {
  kind: 'jetson',
  build: buildJetson,
};

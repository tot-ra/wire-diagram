import type { Component, Diagram } from '../src/types';

export interface GallerySection {
  id: string;
  label: string;
  components: Component[];
}

/** One-component diagram so a gallery card can mount its own widget/canvas. */
export function isolateComponent(component: Component): Diagram {
  return {
    version: 1,
    title: component.label,
    groups: [],
    notes: [],
    wires: [],
    components: [
      {
        id: component.id,
        label: component.label,
        kind: component.kind,
        notes: component.notes,
        dimensions: [...component.dimensions],
        // Sit on the ground plane; catalog world coordinates would leave the camera looking at empty space.
        position: [0, component.dimensions[1] / 2, 0],
        schematic: [80, 80],
        color: component.color,
        pins: component.pins.map((pin) => ({ ...pin })),
        properties: component.properties,
        model: component.model,
        purchase: component.purchase,
        quantity: component.quantity,
      },
    ],
  };
}

/** Preserve YAML group order so the first showcase heading stays "Beehive sensor bench". */
export function gallerySections(diagram: Diagram): GallerySection[] {
  const byGroup = new Map<string, Component[]>();
  const ungrouped: Component[] = [];
  for (const component of diagram.components) {
    if (!component.group) {
      ungrouped.push(component);
      continue;
    }
    const list = byGroup.get(component.group) ?? [];
    list.push(component);
    byGroup.set(component.group, list);
  }
  const sections = diagram.groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      components: byGroup.get(group.id) ?? [],
    }))
    .filter((section) => section.components.length > 0);
  if (ungrouped.length) sections.push({ id: 'other', label: 'Other', components: ungrouped });
  return sections;
}

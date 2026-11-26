import { pathKey, type ListPath, type StepPath } from "./workflow-tree";
import type { WorkflowStep } from "./types";

/** Nodes are a fixed size so edge geometry is exact. Summaries clamp to one line. */
export const NODE_W = 280;
export const NODE_H = 78;
const VGAP = 70;
const HGAP = 44;
const PAD = 60;

export const TRIGGER_KEY = "trigger";

export interface Placed {
  key: string;
  /** Absent on the trigger node. */
  path?: StepPath;
  /** Top-left corner, in canvas coordinates. */
  x: number;
  y: number;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  label?: "True" | "False";
}

/** Where an empty branch's first block would go, so it can show an add button. */
export interface Ghost {
  listPath: ListPath;
  x: number;
  y: number;
}

export interface Layout {
  nodes: Placed[];
  edges: Edge[];
  ghosts: Ghost[];
  width: number;
  height: number;
  byKey: Map<string, Placed>;
}

interface Sub {
  nodes: Placed[];
  edges: Edge[];
  ghosts: Ghost[];
  width: number;
  height: number;
  /** First node, so a parent knows what to point at. */
  entry?: string;
  /** Nodes that flow onward, so the next block knows what points at it. */
  exits: string[];
}

/**
 * Lays a list of steps out as a column, centred on x = 0. An If block puts its two
 * branches side by side underneath, then the column continues below them - which is
 * exactly what the engine does, since a branch rejoins the parent list when it ends.
 */
function layoutList(steps: WorkflowStep[], listPath: ListPath): Sub {
  const nodes: Placed[] = [];
  const edges: Edge[] = [];
  const ghosts: Ghost[] = [];
  let y = 0;
  let width = NODE_W;
  let entry: string | undefined;
  let prevExits: string[] = [];

  steps.forEach((step, i) => {
    const path = [...listPath, i];
    const key = pathKey(path);

    nodes.push({ key, path, x: -NODE_W / 2, y });
    if (!entry) entry = key;
    for (const from of prevExits) edges.push({ id: `${from}->${key}`, from, to: key });
    prevExits = [key];
    y += NODE_H + VGAP;

    if (step.type === "if") {
      const left = layoutList(step.then, [...path, "then"]);
      const right = layoutList(step.else ?? [], [...path, "else"]);

      const branchWidth = left.width + HGAP + right.width;
      width = Math.max(width, branchWidth);

      const leftCentre = -branchWidth / 2 + left.width / 2;
      const rightCentre = branchWidth / 2 - right.width / 2;

      nodes.push(...left.nodes.map((n) => ({ ...n, x: n.x + leftCentre, y: n.y + y })));
      nodes.push(...right.nodes.map((n) => ({ ...n, x: n.x + rightCentre, y: n.y + y })));
      ghosts.push(...left.ghosts.map((g) => ({ ...g, x: g.x + leftCentre, y: g.y + y })));
      ghosts.push(...right.ghosts.map((g) => ({ ...g, x: g.x + rightCentre, y: g.y + y })));
      edges.push(...left.edges, ...right.edges);

      if (left.entry) {
        edges.push({ id: `${key}->${left.entry}`, from: key, to: left.entry, label: "True" });
      }
      if (right.entry) {
        edges.push({ id: `${key}->${right.entry}`, from: key, to: right.entry, label: "False" });
      }

      // An empty branch means the If itself flows on to whatever comes next.
      const exits = [
        ...(left.entry ? left.exits : [key]),
        ...(right.entry ? right.exits : [key]),
      ];
      prevExits = [...new Set(exits)];

      y += Math.max(left.height, right.height);
    }
  });

  if (steps.length === 0) {
    ghosts.push({ listPath, x: -NODE_W / 2, y: 0 });
    return { nodes, edges, ghosts, width, height: NODE_H, entry, exits: prevExits };
  }

  return { nodes, edges, ghosts, width, height: y, entry, exits: prevExits };
}

/**
 * Full canvas layout: the trigger, then the blocks. A step's own `position` overrides
 * the computed spot, which is how dragging a block sticks.
 */
export function layoutWorkflow(
  steps: WorkflowStep[],
  overrides: Map<string, { x: number; y: number }>,
): Layout {
  const body = layoutList(steps, []);

  const nodes: Placed[] = [
    { key: TRIGGER_KEY, x: -NODE_W / 2, y: 0 },
    ...body.nodes.map((n) => ({ ...n, y: n.y + NODE_H + VGAP })),
  ];

  const ghosts = body.ghosts.map((g) => ({ ...g, y: g.y + NODE_H + VGAP }));
  const edges: Edge[] = [...body.edges];
  if (body.entry) {
    edges.push({ id: `${TRIGGER_KEY}->${body.entry}`, from: TRIGGER_KEY, to: body.entry });
  } else {
    ghosts.push({ listPath: [], x: -NODE_W / 2, y: NODE_H + VGAP });
  }

  // Normalise the AUTO layout first and only once, so it is a stable coordinate space.
  // Saved positions are already expressed in that space and must not be shifted again -
  // doing so would make a block drift further every time it is dragged, and would move
  // every other block along with it.
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const auto = nodes.map((n) => ({ ...n, x: n.x - minX + PAD, y: n.y - minY + PAD }));
  const autoGhosts = ghosts.map((g) => ({ ...g, x: g.x - minX + PAD, y: g.y - minY + PAD }));

  const placed = auto.map((n) => {
    const override = overrides.get(n.key);
    return override ? { ...n, x: override.x, y: override.y } : n;
  });

  const width = Math.max(...placed.map((n) => n.x + NODE_W)) + PAD;
  const height = Math.max(...placed.map((n) => n.y + NODE_H)) + PAD;

  return {
    nodes: placed,
    edges,
    ghosts: autoGhosts,
    width,
    height,
    byKey: new Map(placed.map((n) => [n.key, n])),
  };
}

/**
 * A rounded elbow from one node's bottom port to another's top port, the shape Attio
 * draws. Works in any direction, so it still reads once blocks have been dragged around.
 */
export function elbowPath(from: Placed, to: Placed): string {
  const x1 = from.x + NODE_W / 2;
  const y1 = from.y + NODE_H;
  const x2 = to.x + NODE_W / 2;
  const y2 = to.y;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (Math.abs(dx) < 1) return `M ${x1} ${y1} V ${y2}`;

  const dirX = Math.sign(dx);
  const dirY = Math.sign(dy) || 1;
  const midY = y1 + dy / 2;
  const r = Math.max(0, Math.min(16, Math.abs(dx) / 2, Math.abs(dy) / 2));

  return [
    `M ${x1} ${y1}`,
    `V ${midY - dirY * r}`,
    `Q ${x1} ${midY} ${x1 + dirX * r} ${midY}`,
    `H ${x2 - dirX * r}`,
    `Q ${x2} ${midY} ${x2} ${midY + dirY * r}`,
    `V ${y2}`,
  ].join(" ");
}

export function collectPositions(steps: WorkflowStep[]): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();

  const walk = (list: WorkflowStep[], base: ListPath) => {
    list.forEach((step, i) => {
      const path = [...base, i];
      const position = (step as WorkflowStep & { position?: { x: number; y: number } }).position;
      if (position) out.set(pathKey(path), position);
      if (step.type === "if") {
        walk(step.then, [...path, "then"]);
        walk(step.else ?? [], [...path, "else"]);
      }
    });
  };

  walk(steps, []);
  return out;
}

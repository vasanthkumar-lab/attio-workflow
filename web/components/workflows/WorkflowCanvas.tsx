"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Blocks, ChevronDown, Crosshair, Hand, MousePointer2, Plus, Target, TriangleAlert, Zap,
} from "lucide-react";
import { BLOCK_ICONS, BlockPicker } from "./BlockLibrary";
import { blockSummary } from "./blockSummary";
import { IconButton, Menu, MenuItem } from "@/components/ui";
import { blockDef, triggerDef, TONE_CLASSES } from "@/lib/catalog";
import { describeCondition } from "@/lib/conditions";
import { stepProblem } from "@/lib/drafts";
import { cx } from "@/lib/format";
import {
  collectPositions, elbowPath, layoutWorkflow, NODE_H, NODE_W, TRIGGER_KEY,
  type Edge, type Placed,
} from "@/lib/workflow-layout";
import {
  getStep, insertStep, pathKey, samePath, updateStep,
  type ListPath, type StepPath,
} from "@/lib/workflow-tree";
import type { Sequence, WorkflowInput, WorkflowStep } from "@/lib/types";

export type Selection =
  | { kind: "none" }
  | { kind: "trigger" }
  | { kind: "step"; path: StepPath };

type Tool = "pointer" | "hand";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5];
const DRAG_THRESHOLD = 4;

/**
 * The builder canvas. Blocks sit at real coordinates and can be dragged anywhere;
 * anything without a saved position falls back to an auto layout computed from the
 * step tree. Edges are rounded elbows between the ports.
 *
 * Dragging a block is visual only - the order the engine runs them in comes from the
 * steps array, not from where they sit. Use Move up / Move down to change order.
 */
export function WorkflowCanvas({
  draft,
  selected,
  onSelect,
  onChange,
  sequencesById,
}: {
  draft: WorkflowInput;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  onChange: (next: WorkflowInput) => void;
  sequencesById: Map<string, Sequence>;
}) {
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>("pointer");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [adding, setAdding] = useState<{ listPath: ListPath; index: number; x: number; y: number }>();

  /** Live position while a node is dragged, before it is written to the draft. */
  const [nodeDrag, setNodeDrag] = useState<{ key: string; x: number; y: number }>();

  const viewportRef = useRef<HTMLDivElement>(null);
  const panFrom = useRef<{ px: number; py: number; x: number; y: number } | undefined>(undefined);

  const grabbing = tool === "hand" || spaceHeld;

  /**
   * The in-flight node drag. Everything lives in the ref rather than state because the
   * final position is read on pointerup: reading it from state would race the last
   * render and silently drop the move.
   */
  const dragRef = useRef<
    { key: string; px: number; py: number; x: number; y: number; moved: boolean } | undefined
  >(undefined);

  // Read by the window-level drag listeners, which are not recreated per render.
  const zoomRef = useRef(view.zoom);
  zoomRef.current = view.zoom;
  const grabbingRef = useRef(grabbing);
  grabbingRef.current = grabbing;

  // ------------------------------------------------------------------ layout

  const layout = useMemo(() => {
    const positions = collectPositions(draft.steps);
    if (draft.trigger.position) positions.set(TRIGGER_KEY, draft.trigger.position);
    if (nodeDrag) positions.set(nodeDrag.key, { x: nodeDrag.x, y: nodeDrag.y });
    return layoutWorkflow(draft.steps, positions);
  }, [draft.steps, draft.trigger.position, nodeDrag]);

  const writePosition = useCallback(
    (raw: string, at: { x: number; y: number }) => {
      const key = raw;
      // Keep coordinates non-negative so the content box never needs re-origining,
      // which is what made dragged blocks drift.
      const position = { x: Math.round(Math.max(0, at.x)), y: Math.round(Math.max(0, at.y)) };
      if (key === TRIGGER_KEY) {
        onChange({ ...draft, trigger: { ...draft.trigger, position } });
        return;
      }
      const path = key.split(".").map((s) => (s === "then" || s === "else" ? s : Number(s)));
      const step = getStep(draft.steps, path as StepPath);
      if (!step) return;
      onChange({
        ...draft,
        steps: updateStep(draft.steps, path as StepPath, { ...step, position } as WorkflowStep),
      });
    },
    [draft, onChange],
  );

  // --------------------------------------------------------------- shortcuts

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      return Boolean(
        node &&
          (node.tagName === "INPUT" ||
            node.tagName === "TEXTAREA" ||
            node.tagName === "SELECT" ||
            node.isContentEditable),
      );
    };

    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceHeld(true);
      } else if (e.key === "v" || e.key === "V") setTool("pointer");
      else if (e.key === "h" || e.key === "H") setTool("hand");
      else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        openPickerAtEnd();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setView((v) => ({ ...v, zoom: 1 }));
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.steps.length, layout]);

  // -------------------------------------------------------------- pan & zoom

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-pan]")) return;

    const middleClick = e.button === 1;
    if (!grabbing && !middleClick && target.closest("button, input, select, textarea, a")) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panFrom.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
    setPanning(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const from = panFrom.current;
    if (!from) return;
    setView((v) => ({ ...v, x: from.x + (e.clientX - from.px), y: from.y + (e.clientY - from.py) }));
  };

  const endPointer = (e: React.PointerEvent) => {
    if (panFrom.current) {
      panFrom.current = undefined;
      setPanning(false);
    }
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };

  /**
   * Starts a node drag. Listeners go on the window rather than the node so the drag
   * survives the re-renders that move the node out from under the cursor.
   */
  const beginNodeDrag = useCallback(
    (e: React.PointerEvent, node: Placed, onClick: () => void) => {
      if (grabbingRef.current || e.button !== 0) return;
      e.stopPropagation();

      dragRef.current = {
        key: node.key, px: e.clientX, py: e.clientY, x: node.x, y: node.y, moved: false,
      };

      const move = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        if (!d.moved && Math.hypot(ev.clientX - d.px, ev.clientY - d.py) <= DRAG_THRESHOLD) return;
        d.moved = true;
        d.x = d.x + (ev.clientX - d.px) / zoomRef.current;
        d.y = d.y + (ev.clientY - d.py) / zoomRef.current;
        d.px = ev.clientX;
        d.py = ev.clientY;
        setNodeDrag({ key: d.key, x: d.x, y: d.y });
      };

      const finish = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        const d = dragRef.current;
        dragRef.current = undefined;
        setNodeDrag(undefined);
        if (!d) return;
        if (d.moved) writePosition(d.key, { x: d.x, y: d.y });
        else onClick();
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [writePosition],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      // Panels floating over the canvas scroll themselves.
      if ((e.target as HTMLElement | null)?.closest("[data-no-pan]")) return;
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        const rect = viewport.getBoundingClientRect();
        const cx0 = e.clientX - rect.left;
        const cy0 = e.clientY - rect.top;
        setView((v) => {
          const zoom = clamp(v.zoom * (e.deltaY < 0 ? 1.08 : 0.92), MIN_ZOOM, MAX_ZOOM);
          const ratio = zoom / v.zoom;
          return { zoom, x: cx0 - (cx0 - v.x) * ratio, y: cy0 - (cy0 - v.y) * ratio };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  const setZoom = useCallback((zoom: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return setView((v) => ({ ...v, zoom }));
    const rect = viewport.getBoundingClientRect();
    const cx0 = rect.width / 2;
    const cy0 = rect.height / 2;
    setView((v) => {
      const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
      const ratio = next / v.zoom;
      return { zoom: next, x: cx0 - (cx0 - v.x) * ratio, y: cy0 - (cy0 - v.y) * ratio };
    });
  }, []);

  /** Fits the whole graph in view - the "zoom to fit" half of Organize blocks. */
  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const zoom = clamp(Math.min(vw / layout.width, vh / layout.height, 1), MIN_ZOOM, MAX_ZOOM);
    setView({
      zoom,
      x: (vw - layout.width * zoom) / 2,
      y: Math.max(16, (vh - layout.height * zoom) / 2),
    });
  }, [layout.width, layout.height]);

  /** Drops every saved position so the auto layout takes over again, then refits. */
  const organize = useCallback(() => {
    const strip = (steps: WorkflowStep[]): WorkflowStep[] =>
      steps.map((step) => {
        const { position: _drop, ...rest } = step as WorkflowStep & { position?: unknown };
        const cleaned = rest as WorkflowStep;
        if (cleaned.type === "if") {
          return { ...cleaned, then: strip(cleaned.then), else: strip(cleaned.else ?? []) };
        }
        return cleaned;
      });

    const { position: _t, ...trigger } = draft.trigger;
    onChange({ ...draft, trigger, steps: strip(draft.steps) });
  }, [draft, onChange]);

  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    fitToView();
  }, [fitToView]);

  // ------------------------------------------------------------------ adding

  const openPickerAfter = (node: Placed) => {
    if (!node.path) {
      setAdding({ listPath: [], index: 0, x: node.x + NODE_W + 48, y: node.y });
      return;
    }
    const listPath = node.path.slice(0, -1);
    const index = (node.path[node.path.length - 1] as number) + 1;
    setAdding({ listPath, index, x: node.x + NODE_W + 48, y: node.y });
  };

  const openPickerAtEnd = () => {
    const last = layout.nodes[layout.nodes.length - 1] ?? layout.byKey.get(TRIGGER_KEY);
    setAdding({
      listPath: [],
      index: draft.steps.length,
      x: (last?.x ?? 0) + NODE_W + 48,
      y: last?.y ?? 0,
    });
  };

  const addStep = (step: WorkflowStep) => {
    if (!adding) return;
    onChange({ ...draft, steps: insertStep(draft.steps, adding.listPath, adding.index, step) });
    onSelect({ kind: "step", path: [...adding.listPath, adding.index] });
    setAdding(undefined);
  };

  const trigger = triggerDef(draft.trigger.event);

  return (
    <div className="canvas-dark relative flex min-h-0 flex-1 flex-col bg-canvas">
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClick={(e) => {
          if (e.target === e.currentTarget && !panning) onSelect({ kind: "none" });
        }}
        className={cx(
          "canvas-grid relative min-h-0 flex-1 touch-none overflow-hidden",
          panning ? "cursor-grabbing" : grabbing ? "cursor-grab" : "cursor-default",
        )}
      >
        <div
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            transformOrigin: "0 0",
            width: layout.width,
            height: layout.height,
          }}
          className="absolute left-0 top-0"
        >
          <EdgeLayer edges={layout.edges} byKey={layout.byKey} width={layout.width} height={layout.height} />

          {layout.nodes.map((node) => {
            const isTrigger = node.key === TRIGGER_KEY;
            const step = node.path ? getStep(draft.steps, node.path) : undefined;
            if (!isTrigger && !step) return null;

            const def = step ? blockDef(step.type) : undefined;
            const Icon = step ? BLOCK_ICONS[step.type] : Zap;
            const isSelected = isTrigger
              ? selected.kind === "trigger"
              : selected.kind === "step" && samePath(selected.path, node.path!);

            return (
              <NodeCard
                key={node.key}
                node={node}
                icon={<Icon size={14} />}
                toneChip={def ? TONE_CLASSES[def.tone].chip : "bg-accent-soft text-accent-ink"}
                badge={isTrigger ? "Trigger" : undefined}
                title={isTrigger ? trigger.label : def!.label}
                summary={
                  isTrigger
                    ? draft.trigger.condition
                      ? describeCondition(draft.trigger.condition)
                      : draft.trigger.fields?.length
                        ? `When ${draft.trigger.fields.join(", ")} changes`
                        : trigger.description
                    : blockSummary(step!, sequencesById)
                }
                problem={step ? stepProblem(step) : undefined}
                selected={isSelected}
                dragging={nodeDrag?.key === node.key}
                onPointerDown={(e) =>
                  beginNodeDrag(e, node, () =>
                    onSelect(isTrigger ? { kind: "trigger" } : { kind: "step", path: node.path! }),
                  )
                }
                onAdd={() => openPickerAfter(node)}
              />
            );
          })}

          {layout.ghosts.map((ghost) => (
            <button
              key={`ghost-${pathKey(ghost.listPath)}`}
              type="button"
              style={{ left: ghost.x, top: ghost.y, width: NODE_W, height: NODE_H }}
              onClick={() =>
                setAdding({ listPath: ghost.listPath, index: 0, x: ghost.x, y: ghost.y })
              }
              className="absolute flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-surface/40 text-[12px] font-medium text-muted transition-colors hover:border-accent hover:bg-accent-soft/30 hover:text-accent-ink"
            >
              <Plus size={14} />
              Add block
            </button>
          ))}

          {adding && (
            <div className="absolute z-20" style={{ left: adding.x, top: adding.y }} data-no-pan>
              <BlockPicker onPick={addStep} onCancel={() => setAdding(undefined)} />
            </div>
          )}
        </div>
      </div>

      <Toolbar
        zoom={view.zoom}
        tool={tool}
        onTool={setTool}
        onZoom={setZoom}
        onFit={fitToView}
        onOrganize={() => {
          organize();
          setTimeout(fitToView, 0);
        }}
        onAddBlock={openPickerAtEnd}
      />
    </div>
  );
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// --------------------------------------------------------------------- edges

function EdgeLayer({
  edges, byKey, width, height,
}: {
  edges: Edge[];
  byKey: Map<string, Placed>;
  width: number;
  height: number;
}) {
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 text-line-strong"
      width={width}
      height={height}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="wf-arrow"
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 6 4 L 0 7 z" fill="currentColor" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const from = byKey.get(edge.from);
        const to = byKey.get(edge.to);
        if (!from || !to) return null;

        const midX = (from.x + to.x) / 2 + NODE_W / 2;
        const midY = (from.y + NODE_H + to.y) / 2;

        return (
          <g key={edge.id}>
            <path
              d={elbowPath(from, to)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              markerEnd="url(#wf-arrow)"
            />
            {edge.label && (
              <>
                <rect
                  x={midX - 20}
                  y={midY - 9}
                  width="40"
                  height="18"
                  rx="5"
                  className={edge.label === "True" ? "fill-good-soft" : "fill-raised"}
                />
                <text
                  x={midX}
                  y={midY + 4}
                  textAnchor="middle"
                  className={cx(
                    "text-[10px] font-semibold",
                    edge.label === "True" ? "fill-good" : "fill-muted",
                  )}
                >
                  {edge.label}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// --------------------------------------------------------------------- nodes

function NodeCard({
  node, icon, toneChip, badge, title, summary, problem, selected, dragging, onPointerDown, onAdd,
}: {
  node: Placed;
  icon: React.ReactNode;
  toneChip: string;
  badge?: string;
  title: string;
  summary: string;
  problem?: string;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onAdd: () => void;
}) {

  return (
    <div
      className="group absolute"
      style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
    >
      {badge && (
        <span className="absolute -top-6 left-0 inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-ink">
          <Target size={11} />
          {badge}
        </span>
      )}

      <div
        role="button"
        tabIndex={-1}
        onPointerDown={onPointerDown}
        className={cx(
          "h-full cursor-grab rounded-xl border bg-surface px-3 py-2.5 shadow-card transition-colors active:cursor-grabbing",
          dragging && "opacity-80 shadow-pop",
          selected ? "border-accent ring-2 ring-accent/25" : "border-line hover:border-line-strong",
        )}
      >
        <div className="flex items-start gap-2.5">
          <span className={cx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", toneChip)}>
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{title}</p>
            <p className="mt-0.5 line-clamp-1 text-[12px] leading-snug text-muted">{summary}</p>
          </div>
          {problem && (
            <span title={problem} className="mt-0.5 shrink-0 text-warn">
              <TriangleAlert size={14} />
            </span>
          )}
        </div>
      </div>

      {/* Output port, and the + that inserts the next block after this one. */}
      <span
        className={cx(
          "pointer-events-none absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 bg-surface",
          selected ? "border-accent" : "border-line-strong",
        )}
      />
      <button
        type="button"
        onClick={onAdd}
        title="Add a block after this one"
        aria-label="Add a block after this one"
        className="absolute -right-9 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md bg-accent text-white opacity-0 shadow-pop transition-opacity hover:bg-accent-ink group-hover:opacity-100"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

// ------------------------------------------------------------------- toolbar

function Toolbar({
  zoom, tool, onTool, onZoom, onFit, onOrganize, onAddBlock,
}: {
  zoom: number;
  tool: Tool;
  onTool: (t: Tool) => void;
  onZoom: (z: number) => void;
  onFit: () => void;
  onOrganize: () => void;
  onAddBlock: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-line-strong bg-surface p-1 shadow-pop" data-no-pan>
        <Menu
          align="left"
          placement="above"
          className="min-w-44"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-muted hover:bg-raised hover:text-ink"
            >
              <Crosshair size={14} />
              {Math.round(zoom * 100)}%
              <ChevronDown size={12} />
            </button>
          )}
        >
          {ZOOM_STEPS.map((z) => (
            <MenuItem key={z} onClick={() => onZoom(z)}>
              {Math.round(z * 100)}%
            </MenuItem>
          ))}
          <MenuItem onClick={onFit}>Zoom to fit</MenuItem>
        </Menu>

        <span className="mx-0.5 h-5 w-px bg-line" />

        <ToolButton
          active={tool === "hand"}
          label="Pan tool - drag to move the canvas (H, or hold space)"
          onClick={() => onTool("hand")}
        >
          <Hand size={15} />
        </ToolButton>
        <ToolButton
          active={tool === "pointer"}
          label="Select tool - drag a block to move it (V)"
          onClick={() => onTool("pointer")}
        >
          <MousePointer2 size={15} />
        </ToolButton>

        <span className="mx-0.5 h-5 w-px bg-line" />

        <button
          type="button"
          onClick={onAddBlock}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-ink hover:bg-raised"
        >
          <Blocks size={15} />
          Add block
          <kbd className="rounded border border-line-strong bg-canvas px-1 font-sans text-[10px] text-muted">
            B
          </kbd>
        </button>

        <IconButton
          label="Organize blocks - clear manual positions and tidy the layout"
          onClick={onOrganize}
          className="h-8 w-8"
        >
          <Target size={15} />
        </IconButton>
      </div>
    </div>
  );
}

function ToolButton({
  active, label, onClick, children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        "grid h-8 w-8 place-items-center rounded-lg transition-colors",
        active ? "bg-accent text-white" : "text-muted hover:bg-raised hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

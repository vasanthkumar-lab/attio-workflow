"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Blocks, ChevronDown, Crosshair, Hand, Minus, MousePointer2, Plus, Target, Zap,
} from "lucide-react";
import { BLOCK_ICONS, BlockPicker } from "./BlockLibrary";
import { blockSummary } from "./blockSummary";
import { IconButton, Menu, MenuItem } from "@/components/ui";
import { blockDef, triggerDef, TONE_CLASSES } from "@/lib/catalog";
import { describeCondition } from "@/lib/conditions";
import { cx } from "@/lib/format";
import { insertStep, pathKey, samePath, type ListPath, type StepPath } from "@/lib/workflow-tree";
import type { Sequence, WorkflowInput, WorkflowStep } from "@/lib/types";

export type Selection =
  | { kind: "none" }
  | { kind: "trigger" }
  | { kind: "step"; path: StepPath };

type Tool = "pointer" | "hand";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * The builder canvas. Pans by dragging (hand tool, middle mouse, or space held),
 * zooms with the toolbar or ctrl/cmd + wheel, and lays blocks out top to bottom with
 * If blocks splitting into a True and a False column.
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
  const [adding, setAdding] = useState<{ listPath: ListPath; index: number }>();

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  type DragOrigin = { px: number; py: number; x: number; y: number };
  const dragFrom = useRef<DragOrigin | undefined>(undefined);

  const grabbing = tool === "hand" || spaceHeld;

  // --------------------------------------------------------------- shortcuts

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      return (
        node.tagName === "INPUT" ||
        node.tagName === "TEXTAREA" ||
        node.tagName === "SELECT" ||
        node.isContentEditable
      );
    };

    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceHeld(true);
      } else if (e.key === "v" || e.key === "V") {
        setTool("pointer");
      } else if (e.key === "h" || e.key === "H") {
        setTool("hand");
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setAdding({ listPath: [], index: draft.steps.length });
      } else if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setView({ x: 0, y: 0, zoom: 1 });
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
  }, [draft.steps.length]);

  // ------------------------------------------------------------- pan handling

  const onPointerDown = (e: React.PointerEvent) => {
    const middleClick = e.button === 1;
    // With the hand tool or middle mouse you can drag anywhere. With the select tool you
    // can still drag the canvas, as long as the press did not land on a node or a control.
    if (!grabbing && !middleClick) {
      const target = e.target as HTMLElement;
      const onControl = target.closest("button, input, select, textarea, a, [data-no-pan]");
      if (onControl) return;
    }
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragFrom.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
    setPanning(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const from = dragFrom.current;
    if (!from) return;
    setView((v) => ({
      ...v,
      x: from.x + (e.clientX - from.px),
      y: from.y + (e.clientY - from.py),
    }));
  };

  const endPan = (e: React.PointerEvent) => {
    if (!dragFrom.current) return;
    dragFrom.current = undefined;
    setPanning(false);
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // Wheel scrolls the canvas; ctrl/cmd + wheel zooms toward the cursor.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = viewport.getBoundingClientRect();
        const cx0 = e.clientX - rect.left;
        const cy0 = e.clientY - rect.top;
        setView((v) => {
          const zoom = clamp(v.zoom * (e.deltaY < 0 ? 1.08 : 0.92), MIN_ZOOM, MAX_ZOOM);
          const ratio = zoom / v.zoom;
          // Keep the point under the cursor fixed while scaling.
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

  /** Centres the blocks in the viewport, the way Attio's Organize blocks does. */
  const organize = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const vw = viewport.clientWidth;
    const cw = content.offsetWidth;
    setView((v) => ({ ...v, x: (vw - cw * v.zoom) / 2, y: 32 }));
  }, []);

  useEffect(() => {
    organize();
    // Centre once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ adding

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
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onClick={(e) => {
          // A click on empty canvas clears the selection, like Attio.
          if (e.target === e.currentTarget && !panning) onSelect({ kind: "none" });
        }}
        className={cx(
          "canvas-grid relative min-h-0 flex-1 touch-none overflow-hidden",
          panning ? "cursor-grabbing" : grabbing ? "cursor-grab" : "cursor-default",
        )}
      >
        <div
          ref={contentRef}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            transformOrigin: "0 0",
          }}
          className="absolute left-0 top-0 w-[460px] pb-24"
        >
          <div className="flex flex-col items-stretch px-4 pt-2">
            <TriggerNode
              label={trigger.label}
              description={
                draft.trigger.condition
                  ? describeCondition(draft.trigger.condition)
                  : draft.trigger.fields?.length
                    ? `When ${draft.trigger.fields.join(", ")} changes`
                    : trigger.description
              }
              selected={selected.kind === "trigger"}
              onClick={() => onSelect({ kind: "trigger" })}
            />

            <StepList
              steps={draft.steps}
              listPath={[]}
              selected={selected}
              onSelect={onSelect}
              adding={adding}
              onAdd={(listPath, index) => setAdding({ listPath, index })}
              onPick={addStep}
              onCancelAdd={() => setAdding(undefined)}
              sequencesById={sequencesById}
            />
          </div>
        </div>
      </div>

      <Toolbar
        zoom={view.zoom}
        tool={tool}
        onTool={setTool}
        onZoom={setZoom}
        onReset={() => setView({ x: 0, y: 0, zoom: 1 })}
        onOrganize={organize}
        onAddBlock={() => setAdding({ listPath: [], index: draft.steps.length })}
      />
    </div>
  );
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// ------------------------------------------------------------------- toolbar

function Toolbar({
  zoom, tool, onTool, onZoom, onReset, onOrganize, onAddBlock,
}: {
  zoom: number;
  tool: Tool;
  onTool: (t: Tool) => void;
  onZoom: (z: number) => void;
  onReset: () => void;
  onOrganize: () => void;
  onAddBlock: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-line-strong bg-surface p-1 shadow-pop">
        <Menu
          align="left"
          placement="above"
          className="min-w-40"
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
          <MenuItem onClick={onReset}>Reset to 100%</MenuItem>
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
          label="Select tool (V)"
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

        <IconButton label="Organize blocks - recentre the canvas" onClick={onOrganize} className="h-8 w-8">
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

// --------------------------------------------------------------------- nodes

function TriggerNode({
  label, description, selected, onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch">
      <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-ink">
        <Target size={11} />
        Trigger
      </span>
      <NodeCard
        icon={<Zap size={14} />}
        toneChip="bg-accent-soft text-accent-ink"
        title={label}
        summary={description}
        selected={selected}
        onClick={onClick}
      />
    </div>
  );
}

function NodeCard({
  icon, toneChip, title, summary, selected, onClick,
}: {
  icon: React.ReactNode;
  toneChip: string;
  title: string;
  summary: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative rounded-xl border bg-surface px-3 py-2.5 text-left shadow-card transition-colors",
        selected
          ? "border-accent ring-2 ring-accent/25"
          : "border-line hover:border-line-strong",
      )}
    >
      <span className="flex items-start gap-2.5">
        <span className={cx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", toneChip)}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink">{title}</span>
          <span className="mt-0.5 block break-words text-[12px] leading-snug text-muted">
            {summary}
          </span>
        </span>
      </span>

      {/* The output port, like the circle you drag from in Attio. */}
      <span
        className={cx(
          "absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 bg-surface",
          selected ? "border-accent" : "border-line-strong",
        )}
      />
    </button>
  );
}

/** A vertical connector with an arrowhead at the bottom. */
function Connector({ height = 28 }: { height?: number }) {
  return (
    <span
      className="relative mx-auto block w-px bg-line-strong"
      style={{ height }}
      aria-hidden="true"
    >
      <span className="absolute -bottom-px left-1/2 h-0 w-0 -translate-x-1/2 border-x-[4px] border-t-[6px] border-x-transparent border-t-line-strong" />
    </span>
  );
}

function StepList({
  steps, listPath, selected, onSelect, adding, onAdd, onPick, onCancelAdd, sequencesById, branchLabel,
}: {
  steps: WorkflowStep[];
  listPath: ListPath;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  adding?: { listPath: ListPath; index: number };
  onAdd: (listPath: ListPath, index: number) => void;
  onPick: (step: WorkflowStep) => void;
  onCancelAdd: () => void;
  sequencesById: Map<string, Sequence>;
  branchLabel?: "True" | "False";
}) {
  const addingHere =
    adding && pathKey(adding.listPath) === pathKey(listPath) ? adding.index : undefined;

  return (
    <div className="flex flex-col items-stretch">
      {steps.map((step, index) => {
        const path = [...listPath, index];
        const isSelected = selected.kind === "step" && samePath(selected.path, path);
        const def = blockDef(step.type);
        const Icon = BLOCK_ICONS[step.type];

        return (
          <div key={pathKey(path)} className="flex flex-col items-stretch">
            {addingHere === index && (
              <>
                <Connector />
                <div className="mx-auto" data-no-pan>
                  <BlockPicker onPick={onPick} onCancel={onCancelAdd} />
                </div>
              </>
            )}

            <Connector />
            <NodeCard
              icon={<Icon size={14} />}
              toneChip={TONE_CLASSES[def.tone].chip}
              title={def.label}
              summary={blockSummary(step, sequencesById)}
              selected={isSelected}
              onClick={() => onSelect({ kind: "step", path })}
            />

            {step.type === "if" && (
              <Branches
                step={step}
                path={path}
                selected={selected}
                onSelect={onSelect}
                adding={adding}
                onAdd={onAdd}
                onPick={onPick}
                onCancelAdd={onCancelAdd}
                sequencesById={sequencesById}
              />
            )}
          </div>
        );
      })}

      {addingHere === steps.length ? (
        <>
          <Connector />
          <div className="mx-auto" data-no-pan>
            <BlockPicker onPick={onPick} onCancel={onCancelAdd} />
          </div>
        </>
      ) : (
        <>
          <Connector />
          <button
            type="button"
            onClick={() => onAdd(listPath, steps.length)}
            className="mx-auto inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line-strong bg-surface/60 px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:border-accent hover:bg-accent-soft/40 hover:text-accent-ink"
          >
            <Plus size={13} />
            {steps.length === 0 ? `Add a block to ${branchLabel ?? "this path"}` : "Add block"}
          </button>
        </>
      )}
    </div>
  );
}

function Branches({
  step, path, selected, onSelect, adding, onAdd, onPick, onCancelAdd, sequencesById,
}: {
  step: Extract<WorkflowStep, { type: "if" }>;
  path: StepPath;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  adding?: { listPath: ListPath; index: number };
  onAdd: (listPath: ListPath, index: number) => void;
  onPick: (step: WorkflowStep) => void;
  onCancelAdd: () => void;
  sequencesById: Map<string, Sequence>;
}) {
  return (
    <div className="relative mt-6 grid grid-cols-2 gap-5">
      <span className="absolute -top-6 left-1/2 h-3 w-px -translate-x-1/2 bg-line-strong" />
      <span className="absolute -top-3 left-1/4 right-1/4 h-px bg-line-strong" />
      <span className="absolute -top-3 left-1/4 h-3 w-px bg-line-strong" />
      <span className="absolute -top-3 right-1/4 h-3 w-px bg-line-strong" />

      {(["then", "else"] as const).map((branch) => {
        const label = branch === "then" ? "True" : "False";
        return (
          <div key={branch} className="flex min-w-0 flex-col items-stretch">
            <span
              className={cx(
                "mx-auto rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                branch === "then"
                  ? "bg-good-soft text-good"
                  : "bg-raised text-muted ring-1 ring-line",
              )}
            >
              {label}
            </span>
            <StepList
              steps={branch === "then" ? step.then : step.else ?? []}
              listPath={[...path, branch]}
              selected={selected}
              onSelect={onSelect}
              adding={adding}
              onAdd={onAdd}
              onPick={onPick}
              onCancelAdd={onCancelAdd}
              sequencesById={sequencesById}
              branchLabel={label}
            />
          </div>
        );
      })}
    </div>
  );
}

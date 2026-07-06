"use client";

import Image from "next/image";
import type {
  CSSProperties,
  ClipboardEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useRef, useState } from "react";
import {
  Brush,
  Clipboard,
  Copy,
  Eraser,
  ImagePlus,
  Loader2,
  Paintbrush,
  PencilLine,
  RotateCcw,
  Save,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WhiteboardStateRow } from "@/lib/types";

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const EMPTY_UPDATED_AT = "1970-01-01T00:00:00.000Z";
const BOARD_VERSION = 1;
const COLOR_SWATCHES = [
  "#171b26",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#06b6d4",
  "#1f6fff",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
];

type Tool = "pen" | "eraser" | "select";
type Point = {
  x: number;
  y: number;
};
type BoardImageObject = {
  id: string;
  type: "image";
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type BoardTextObject = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
};
type BoardObject = BoardImageObject | BoardTextObject;
type BoardDocument = {
  version: typeof BOARD_VERSION;
  drawingDataUrl: string;
  objects: BoardObject[];
};
type ObjectInteractionMode = "drag" | "resize";
type ObjectInteraction = {
  ids: string[];
  mode: ObjectInteractionMode;
  start: Point;
  originals: BoardObject[];
};
type SelectionBox = {
  start: Point;
  current: Point;
};
type ContextMenuState = {
  objectId: string | null;
  x: number;
  y: number;
};
type ClientPoint = {
  clientX: number;
  clientY: number;
};

export function WhiteBoardCard({ initialState }: { initialState: WhiteboardStateRow }) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const interactionRef = useRef<ObjectInteraction | null>(null);
  const [state, setState] = useState(initialState);
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState<BoardDocument>(() => parseBoardDocument(initialState));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedObject, setCopiedObject] = useState<BoardObject | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#171b26");
  const [brushSize, setBrushSize] = useState(8);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hasContent = Boolean(state.canvasDataUrl || parseBoardDocument(state).objects.length);
  const selectedIdSet = new Set(selectedIds);
  const hasSelectedObjects = selectedIds.length > 0;
  const selectedObject = document.objects.find((object) => object.id === selectedId) ?? null;
  const selectedTextObject = selectedIds.length === 1 && selectedObject?.type === "text" ? selectedObject : null;
  const contextObject = contextMenu?.objectId
    ? document.objects.find((object) => object.id === contextMenu.objectId) ?? null
    : null;

  const loadDrawingLayer = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (!dataUrl) return;

    const image = new window.Image();
    image.onload = () => {
      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      context.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    };
    image.src = dataUrl;
  }, []);

  function queueDrawingLoad(dataUrl: string) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => loadDrawingLayer(dataUrl));
    });
  }

  async function openEditor() {
    const currentDocument = parseBoardDocument(state);
    setOpen(true);
    setDocument(currentDocument);
    clearObjectSelection();
    setEditingId(null);
    setContextMenu(null);
    setSelectionBox(null);
    setError("");
    setLoading(true);
    queueDrawingLoad(currentDocument.drawingDataUrl);

    try {
      const response = await fetch("/api/whiteboard");
      if (!response.ok) throw new Error("White Board could not be loaded.");
      const { state: latestState } = (await response.json()) as { state: WhiteboardStateRow };
      const latestDocument = parseBoardDocument(latestState);

      setState(latestState);
      setDocument(latestDocument);
      queueDrawingLoad(latestDocument.drawingDataUrl);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "White Board could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function getBoardPoint(event: ReactPointerEvent<HTMLElement>): Point {
    return getBoardPointFromClient(event.clientX, event.clientY);
  }

  function getBoardPointFromClient(clientX: number, clientY: number): Point {
    const board = boardRef.current;
    const rect = board?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: clamp(((clientX - rect.left) / rect.width) * CANVAS_WIDTH, 0, CANVAS_WIDTH),
      y: clamp(((clientY - rect.top) / rect.height) * CANVAS_HEIGHT, 0, CANVAS_HEIGHT),
    };
  }

  function getContextMenuPoint(event: ClientPoint): Point {
    const board = boardRef.current;
    const rect = board?.getBoundingClientRect();
    if (!rect) return { x: 8, y: 8 };

    return {
      x: clamp(event.clientX - rect.left, 4, Math.max(4, rect.width - 164)),
      y: clamp(event.clientY - rect.top, 4, Math.max(4, rect.height - 132)),
    };
  }

  function getCanvasPointFromMenu(menu: ContextMenuState): Point {
    const board = boardRef.current;
    const rect = board?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: (menu.x / rect.width) * CANVAS_WIDTH,
      y: (menu.y / rect.height) * CANVAS_HEIGHT,
    };
  }

  function focusBoard() {
    window.requestAnimationFrame(() => boardRef.current?.focus());
  }

  function selectObjectIds(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    setSelectedIds(uniqueIds);
    setSelectedId(uniqueIds.length ? uniqueIds[uniqueIds.length - 1] : null);
  }

  function selectSingleObject(id: string) {
    selectObjectIds([id]);
  }

  function clearObjectSelection() {
    selectObjectIds([]);
  }

  function drawLine(from: Point, to: Point) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = brushSize;
    context.strokeStyle = tool === "eraser" ? "rgba(0,0,0,1)" : color;
    context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.restore();
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (tool === "select") return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getBoardPoint(event);
    isDrawingRef.current = true;
    lastPointRef.current = point;
    drawLine(point, point);
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !lastPointRef.current) return;

    const point = getBoardPoint(event);
    drawLine(lastPointRef.current, point);
    lastPointRef.current = point;
  }

  function stopDrawing() {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }

  function updateObjects(updater: (objects: BoardObject[]) => BoardObject[]) {
    setDocument((current) => ({
      ...current,
      objects: updater(current.objects),
    }));
  }

  function addTextBox() {
    const id = createObjectId();
    setTool("select");
    selectSingleObject(id);
    setEditingId(id);
    setContextMenu(null);
    focusBoard();
    updateObjects((objects) => [
      ...objects,
      {
        id,
        type: "text",
        text: "Text",
        x: 420,
        y: 270,
        width: 340,
        height: 128,
        fontSize: 42,
        color,
      },
    ]);
  }

  function addImageObject(file: File) {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;

      const image = new window.Image();
      image.onload = () => {
        const maxWidth = CANVAS_WIDTH * 0.48;
        const maxHeight = CANVAS_HEIGHT * 0.58;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const width = Math.max(96, image.width * scale);
        const height = Math.max(72, image.height * scale);
        const id = createObjectId();

        setTool("select");
        selectSingleObject(id);
        setEditingId(null);
        setContextMenu(null);
        focusBoard();
        updateObjects((objects) => [
          ...objects,
          {
            id,
            type: "image",
            src: reader.result as string,
            x: (CANVAS_WIDTH - width) / 2,
            y: (CANVAS_HEIGHT - height) / 2,
            width,
            height,
          },
        ]);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (imageFiles.length === 0) return;

    event.preventDefault();
    imageFiles.forEach(addImageObject);
  }

  function clearBoard() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    context?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    clearObjectSelection();
    setEditingId(null);
    setContextMenu(null);
    setSelectionBox(null);
    updateObjects(() => []);
  }

  function deleteSelectedObject() {
    const idsToDelete = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    if (!idsToDelete.length) return;

    const deleteIdSet = new Set(idsToDelete);
    updateObjects((objects) => objects.filter((object) => !deleteIdSet.has(object.id)));
    clearObjectSelection();
    setEditingId(null);
    setContextMenu(null);
  }

  function editSelectedTextObject() {
    if (!selectedTextObject) return;

    setTool("select");
    selectSingleObject(selectedTextObject.id);
    setEditingId(selectedTextObject.id);
    setContextMenu(null);
  }

  function copyObject(object: BoardObject) {
    setCopiedObject({ ...object });
    if (object.type === "text") {
      void navigator.clipboard?.writeText(object.text).catch(() => undefined);
    }
  }

  function pasteObject(object: BoardObject, position?: Point) {
    const id = createObjectId();
    const x = position ? position.x : object.x + 28;
    const y = position ? position.y : object.y + 28;
    const nextObject = {
      ...object,
      id,
      x: clamp(x, 0, CANVAS_WIDTH - object.width),
      y: clamp(y, 0, CANVAS_HEIGHT - object.height),
    } satisfies BoardObject;

    updateObjects((objects) => [...objects, nextObject]);
    setTool("select");
    selectSingleObject(id);
    setEditingId(null);
    setContextMenu(null);
    focusBoard();
  }

  function selectColor(nextColor: string) {
    setColor(nextColor);
    if (!selectedTextObject) return;

    updateObjects((objects) =>
      objects.map((object) =>
        object.id === selectedTextObject.id && object.type === "text" ? { ...object, color: nextColor } : object,
      ),
    );
  }

  function adjustSelectedTextFontSize(delta: number) {
    if (!selectedTextObject) return;

    const currentFontSize = clamp(selectedTextObject.fontSize, 12, 160);
    const nextFontSize = clamp(currentFontSize + delta, 12, 160);
    const scale = nextFontSize / currentFontSize;

    updateObjects((objects) =>
      objects.map((object) => {
        if (object.id !== selectedTextObject.id || object.type !== "text") return object;

        return {
          ...object,
          fontSize: nextFontSize,
          width: clamp(object.width * scale, 96, CANVAS_WIDTH - object.x),
          height: clamp(object.height * scale, 48, CANVAS_HEIGHT - object.y),
        };
      }),
    );
    setTool("select");
    selectSingleObject(selectedTextObject.id);
    setContextMenu(null);
    focusBoard();
  }

  function handleBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    if (tool !== "select") {
      clearObjectSelection();
      setEditingId(null);
      setContextMenu(null);
      return;
    }

    event.preventDefault();
    const start = getBoardPoint(event);

    clearObjectSelection();
    setEditingId(null);
    setContextMenu(null);
    setSelectionBox({ start, current: start });
    focusBoard();

    const controller = new AbortController();
    const selectObjectsInBox = (current: Point) => {
      const bounds = getSelectionBounds(start, current);

      if (bounds.width < 6 && bounds.height < 6) {
        clearObjectSelection();
        return;
      }

      selectObjectIds(
        document.objects
          .filter((object) => objectIntersectsBounds(object, bounds))
          .map((object) => object.id),
      );
    };
    const handleWindowPointerMove = (moveEvent: globalThis.PointerEvent) => {
      moveEvent.preventDefault();
      const current = getBoardPointFromClient(moveEvent.clientX, moveEvent.clientY);
      setSelectionBox({ start, current });
      selectObjectsInBox(current);
    };
    const handleWindowPointerUp = (upEvent: globalThis.PointerEvent) => {
      const current = getBoardPointFromClient(upEvent.clientX, upEvent.clientY);
      selectObjectsInBox(current);
      setSelectionBox(null);
      controller.abort();
    };

    window.addEventListener("pointermove", handleWindowPointerMove, {
      signal: controller.signal,
      passive: false,
    });
    window.addEventListener("pointerup", handleWindowPointerUp, { signal: controller.signal });
    window.addEventListener("pointercancel", handleWindowPointerUp, { signal: controller.signal });
  }

  function startObjectInteraction(
    event: ReactPointerEvent<HTMLElement>,
    object: BoardObject,
    mode: ObjectInteractionMode,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const dragSelection = mode === "drag" && selectedIdSet.has(object.id) && selectedIds.length > 1;
    const interactionIds = dragSelection ? selectedIds : [object.id];
    selectObjectIds(interactionIds);
    setEditingId(null);
    setContextMenu(null);
    setSelectionBox(null);
    setTool("select");
    focusBoard();
    interactionRef.current = {
      ids: interactionIds,
      mode,
      start: getBoardPoint(event),
      originals: document.objects.filter((item) => interactionIds.includes(item.id)),
    };

    const controller = new AbortController();
    const handleWindowPointerMove = (moveEvent: globalThis.PointerEvent) => {
      moveEvent.preventDefault();
      updateObjectInteraction(getBoardPointFromClient(moveEvent.clientX, moveEvent.clientY));
    };
    const handleWindowPointerUp = () => {
      interactionRef.current = null;
      controller.abort();
    };

    window.addEventListener("pointermove", handleWindowPointerMove, {
      signal: controller.signal,
      passive: false,
    });
    window.addEventListener("pointerup", handleWindowPointerUp, { signal: controller.signal });
    window.addEventListener("pointercancel", handleWindowPointerUp, { signal: controller.signal });
  }

  function updateObjectInteraction(point: Point) {
    const interaction = interactionRef.current;
    if (!interaction) return;

    const dx = point.x - interaction.start.x;
    const dy = point.y - interaction.start.y;

    updateObjects((objects) =>
      objects.map((object) => {
        const original = interaction.originals.find((item) => item.id === object.id);
        if (!original) return object;

        if (interaction.mode === "resize") {
          const minWidth = object.type === "text" ? 96 : 72;
          const minHeight = object.type === "text" ? 48 : 48;
          const width = clamp(original.width + dx, minWidth, CANVAS_WIDTH - original.x);
          const height = clamp(original.height + dy, minHeight, CANVAS_HEIGHT - original.y);

          if (object.type === "text" && original.type === "text") {
            const fontScale = width / Math.max(1, original.width);

            return {
              ...object,
              width,
              height,
              fontSize: clamp(Math.round(original.fontSize * fontScale), 12, 160),
            };
          }

          return {
            ...object,
            width,
            height,
          };
        }

        return {
          ...object,
          x: clamp(original.x + dx, 0, CANVAS_WIDTH - object.width),
          y: clamp(original.y + dy, 0, CANVAS_HEIGHT - object.height),
        };
      }),
    );
  }

  function handleObjectContextMenu(event: MouseEvent<HTMLElement>, object: BoardObject) {
    event.preventDefault();
    event.stopPropagation();
    const point = getContextMenuPoint(event);
    setTool("select");
    selectSingleObject(object.id);
    setEditingId(null);
    setSelectionBox(null);
    setContextMenu({
      objectId: object.id,
      x: point.x,
      y: point.y,
    });
    focusBoard();
  }

  function handleBoardContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const point = getContextMenuPoint(event);
    clearObjectSelection();
    setEditingId(null);
    setSelectionBox(null);
    setContextMenu({
      objectId: null,
      x: point.x,
      y: point.y,
    });
    focusBoard();
  }

  function editContextObject() {
    if (!contextObject) return;

    setTool("select");
    selectSingleObject(contextObject.id);
    setEditingId(contextObject.type === "text" ? contextObject.id : null);
    setContextMenu(null);
  }

  function copyContextObject() {
    if (!contextObject) return;

    copyObject(contextObject);
    setContextMenu(null);
  }

  function pasteCopiedObject() {
    if (!copiedObject) return;

    pasteObject(copiedObject, contextMenu ? getCanvasPointFromMenu(contextMenu) : undefined);
  }

  function deleteContextObject() {
    if (!contextObject) return;

    updateObjects((objects) => objects.filter((object) => object.id !== contextObject.id));
    selectObjectIds(selectedIds.filter((id) => id !== contextObject.id));
    setEditingId((current) => (current === contextObject.id ? null : current));
    setContextMenu(null);
  }

  function handleBoardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setContextMenu(null);
      setEditingId(null);
      setSelectionBox(null);
      return;
    }

    if (editingId) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c" && selectedObject) {
      event.preventDefault();
      copyObject(selectedObject);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v" && copiedObject) {
      event.preventDefault();
      pasteObject(copiedObject);
      return;
    }

    if (!selectedIds.length && !selectedId) return;

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelectedObject();
    }
  }

  async function saveWhiteboard() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    setError("");

    const drawingDataUrl = canvas.toDataURL("image/png");
    const nextDocument: BoardDocument = {
      version: BOARD_VERSION,
      drawingDataUrl,
      objects: document.objects,
    };

    try {
      const nextCanvasDataUrl = await renderBoardPreview(nextDocument);
      const response = await fetch("/api/whiteboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textContent: JSON.stringify(nextDocument),
          canvasDataUrl: nextCanvasDataUrl,
        }),
      });

      const payload = (await response.json()) as { state?: WhiteboardStateRow; error?: string };
      if (!response.ok || !payload.state) {
        throw new Error(payload.error ?? "White Board could not be saved.");
      }

      setState(payload.state);
      setDocument(parseBoardDocument(payload.state));
      setOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "White Board could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex h-full min-h-[347px] flex-col">
        <div className="flex items-center justify-between border-b border-[#eceff3] pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-[#fff3d8] text-[#a15c08]">
              <Paintbrush className="size-4" />
            </span>
            <h2 className="text-lg font-bold tracking-normal text-[#171b26]">보드</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#d9e2ee] text-xs font-bold text-[#373f4f] hover:bg-[#f8fafc]"
            onClick={openEditor}
          >
            수정
          </Button>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-[#e3e8ef] bg-white">
            {state.canvasDataUrl ? (
              <Image
                src={state.canvasDataUrl}
                alt="보드 캔버스"
                fill
                unoptimized
                className="bg-white object-contain"
              />
            ) : (
              <div className="grid h-full place-items-center">
                <Brush className="size-10 text-[#c4ccd8]" />
              </div>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 text-xs font-medium text-[#8a94a6]">
            <span>{hasContent ? "공유 보드" : "비어 있음"}</span>
            <span>{formatUpdatedAt(state.updatedAt)}</span>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[calc(100vh-24px)] max-h-[calc(100vh-24px)] w-[calc(100vw-24px)] !max-w-[1080px] flex-col gap-0 overflow-hidden bg-white p-0">
          <DialogHeader className="shrink-0 border-b border-[#e6ecf3] px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#171b26]">
              <Paintbrush className="size-5 text-[#a15c08]" />
              보드
            </DialogTitle>
            <DialogDescription>
              {state.updatedByName ? `마지막 수정: ${state.updatedByName}` : "대시보드 공유 보드"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
            <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border border-[#e6ecf3] bg-[#f8fafc] p-1.5">
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#d9e2ee] bg-white p-1">
                <Button
                  type="button"
                  variant={tool === "select" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTool("select")}
                  aria-pressed={tool === "select"}
                >
                  <Type className="size-4" />
                  선택
                </Button>
                <Button
                  type="button"
                  variant={tool === "pen" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTool("pen")}
                  aria-pressed={tool === "pen"}
                >
                  <Brush className="size-4" />
                  펜
                </Button>
                <Button
                  type="button"
                  variant={tool === "eraser" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTool("eraser")}
                  aria-pressed={tool === "eraser"}
                >
                  <Eraser className="size-4" />
                  지우개
                </Button>
              </div>

              <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-lg border border-[#d9e2ee] bg-white px-2 py-1">
                <div className="flex items-center gap-1">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={[
                        "size-5 rounded-full border transition focus-visible:ring-2 focus-visible:ring-[#1f6fff]/40 focus-visible:outline-none",
                        color.toLowerCase() === swatch.toLowerCase()
                          ? "scale-110 border-[#111827] shadow-[0_0_0_2px_white,0_0_0_4px_rgba(31,111,255,0.35)]"
                          : "border-[#cbd5e1] hover:scale-105",
                      ].join(" ")}
                      style={{ backgroundColor: swatch }}
                      aria-label={`Select color ${swatch}`}
                      onClick={() => selectColor(swatch)}
                    />
                  ))}
                </div>
                <label className="grid size-7 cursor-pointer place-items-center rounded-md border border-[#d9e2ee] bg-white">
                  <input
                    type="color"
                    value={color}
                    className="size-5 cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Pen and text color"
                    onChange={(event) => selectColor(event.target.value)}
                  />
                </label>
                <input
                  type="range"
                  min="2"
                  max="40"
                  value={brushSize}
                  className="h-8 w-28 accent-[#1f6fff]"
                  aria-label="Brush size"
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#d9e2ee] bg-white p-1">
                <Button type="button" variant="ghost" size="sm" onClick={addTextBox}>
                  <Type className="size-4" />
                  글자
                </Button>
                <Button
                  type="button"
                  variant={editingId ? "default" : "ghost"}
                  size="sm"
                  disabled={!selectedTextObject}
                  onClick={editSelectedTextObject}
                >
                  <PencilLine className="size-4" />
                  편집
                </Button>
                <div className="flex h-8 items-center overflow-hidden rounded-md border border-[#d9e2ee] bg-white text-xs font-bold text-[#373f4f]">
                  <button
                    type="button"
                    className="grid h-full min-w-9 place-items-center px-2 transition hover:bg-[#f3f7ff] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!selectedTextObject}
                    aria-label="Decrease text size"
                    onClick={() => adjustSelectedTextFontSize(-4)}
                  >
                    A-
                  </button>
                  <span className="grid h-full min-w-10 place-items-center border-x border-[#e6ecf3] px-2">
                    {selectedTextObject ? selectedTextObject.fontSize : "--"}
                  </span>
                  <button
                    type="button"
                    className="grid h-full min-w-9 place-items-center px-2 transition hover:bg-[#f3f7ff] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!selectedTextObject}
                    aria-label="Increase text size"
                    onClick={() => adjustSelectedTextFontSize(4)}
                  >
                    A+
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#d9e2ee] bg-white p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="size-4" />
                  이미지
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={!hasSelectedObjects} onClick={deleteSelectedObject}>
                  <Trash2 className="size-4" />
                  삭제
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearBoard}>
                  <RotateCcw className="size-4" />
                  초기화
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  Array.from(event.target.files ?? []).forEach(addImageObject);
                  event.target.value = "";
                }}
              />
            </div>

            <div
              className="min-h-0 flex-1 rounded-lg border border-[#d8e0ea] bg-white p-2 shadow-inner"
              onPaste={handlePaste}
            >
              <div
                ref={boardRef}
                className="relative mx-auto aspect-video h-full max-h-full max-w-full overflow-hidden rounded-md bg-white [container-type:inline-size]"
                tabIndex={0}
                onPointerDown={handleBoardPointerDown}
                onContextMenu={handleBoardContextMenu}
                onKeyDown={handleBoardKeyDown}
              >
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="absolute inset-0 size-full touch-none"
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  onPointerLeave={stopDrawing}
                />

                {document.objects.map((object) => (
                  <BoardObjectView
                    key={object.id}
                    object={object}
                    selected={selectedIdSet.has(object.id)}
                    editing={object.id === editingId}
                    onSelect={() => {
                      selectSingleObject(object.id);
                      setTool("select");
                      focusBoard();
                    }}
                    onEditStart={() => {
                      selectSingleObject(object.id);
                      setEditingId(object.id);
                      setTool("select");
                    }}
                    onEditEnd={() => setEditingId(null)}
                    onTextChange={(text) => {
                      updateObjects((objects) =>
                        objects.map((item) => (item.id === object.id && item.type === "text" ? { ...item, text } : item)),
                      );
                    }}
                    onContextMenu={(event) => handleObjectContextMenu(event, object)}
                    onPointerDown={(event) => startObjectInteraction(event, object, "drag")}
                    onResizePointerDown={(event) => startObjectInteraction(event, object, "resize")}
                  />
                ))}

                {selectionBox ? <SelectionBoxView box={selectionBox} /> : null}

                {contextMenu ? (
                  <WhiteBoardContextMenu
                    menu={contextMenu}
                    object={contextObject}
                    canPaste={Boolean(copiedObject)}
                    onEdit={editContextObject}
                    onCopy={copyContextObject}
                    onPaste={pasteCopiedObject}
                    onDelete={deleteContextObject}
                    onClose={() => setContextMenu(null)}
                  />
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="mt-3 rounded-md border border-[#ffd6df] bg-[#fff4f6] px-3 py-2 text-xs font-semibold text-[#b4233c]">
                {error}
              </div>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-[#e6ecf3] bg-[#f8fafc] px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="border-[#d9e2ee]"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="button" disabled={saving || loading} onClick={saveWhiteboard}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SelectionBoxView({ box }: { box: SelectionBox }) {
  const bounds = getSelectionBounds(box.start, box.current);
  const style = {
    left: `${(bounds.x / CANVAS_WIDTH) * 100}%`,
    top: `${(bounds.y / CANVAS_HEIGHT) * 100}%`,
    width: `${(bounds.width / CANVAS_WIDTH) * 100}%`,
    height: `${(bounds.height / CANVAS_HEIGHT) * 100}%`,
  } satisfies CSSProperties;

  return (
    <div
      className="pointer-events-none absolute z-40 border border-[#1f6fff] bg-[#1f6fff]/10 shadow-[0_0_0_1px_rgba(31,111,255,0.18)]"
      style={style}
    />
  );
}

function BoardObjectView({
  object,
  selected,
  editing,
  onSelect,
  onEditStart,
  onEditEnd,
  onTextChange,
  onContextMenu,
  onPointerDown,
  onResizePointerDown,
}: {
  object: BoardObject;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onTextChange: (text: string) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const style = {
    left: `${(object.x / CANVAS_WIDTH) * 100}%`,
    top: `${(object.y / CANVAS_HEIGHT) * 100}%`,
    width: `${(object.width / CANVAS_WIDTH) * 100}%`,
    height: `${(object.height / CANVAS_HEIGHT) * 100}%`,
  } satisfies CSSProperties;
  const textStyle =
    object.type === "text"
      ? ({
          color: object.color,
          fontSize: `calc(${(object.fontSize / CANVAS_WIDTH) * 100}cqw)`,
          lineHeight: 1.22,
          padding: `calc(${(12 / CANVAS_WIDTH) * 100}cqw)`,
        } satisfies CSSProperties)
      : undefined;

  return (
    <div
      className={[
        "absolute touch-none select-none",
        selected ? "z-20 outline-2 outline-[#1f6fff]" : "z-10 outline-1 outline-transparent",
      ].join(" ")}
      style={style}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={(event) => {
        if (object.type !== "text") return;
        event.preventDefault();
        event.stopPropagation();
        onEditStart();
      }}
    >
      {object.type === "image" ? (
        <Image src={object.src} alt="" fill unoptimized className="pointer-events-none object-fill" />
      ) : editing ? (
        <textarea
          value={object.text}
          className="size-full resize-none border-0 bg-transparent font-bold outline-none"
          style={textStyle}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onBlur={onEditEnd}
          onChange={(event) => onTextChange(event.target.value)}
        />
      ) : (
        <div
          className="size-full cursor-move overflow-hidden font-bold whitespace-pre-wrap"
          style={textStyle}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEditStart();
          }}
        >
          {object.text}
        </div>
      )}
      {selected ? (
        <button
          type="button"
          className="absolute right-0 bottom-0 size-7 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-white bg-[#1f6fff] shadow-[0_2px_8px_rgba(15,28,48,0.24)] transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-[#1f6fff]/40 focus-visible:outline-none"
          aria-label="Resize object"
          onPointerDown={onResizePointerDown}
        />
      ) : null}
    </div>
  );
}

function WhiteBoardContextMenu({
  menu,
  object,
  canPaste,
  onEdit,
  onCopy,
  onPaste,
  onDelete,
  onClose,
}: {
  menu: ContextMenuState;
  object: BoardObject | null;
  canPaste: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute z-[80] min-w-36 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white py-1 text-sm font-semibold text-[#202838] shadow-[0_18px_42px_rgba(15,28,48,0.18)]"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {object ? (
        <>
          <ContextMenuButton icon={<PencilLine className="size-4" />} label="Edit" onClick={onEdit} />
          <ContextMenuButton icon={<Copy className="size-4" />} label="Copy" onClick={onCopy} />
          <ContextMenuButton destructive icon={<Trash2 className="size-4" />} label="Delete" onClick={onDelete} />
        </>
      ) : (
        <ContextMenuButton
          disabled={!canPaste}
          icon={<Clipboard className="size-4" />}
          label="Paste"
          onClick={onPaste}
        />
      )}
      <button
        type="button"
        className="mt-1 flex h-8 w-full items-center px-3 text-xs text-[#8a94a6] hover:bg-[#f8fafc]"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}

function ContextMenuButton({
  icon,
  label,
  disabled = false,
  destructive = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "flex h-9 w-full items-center gap-2 px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
        destructive ? "text-[#d92d20] hover:bg-[#fff4f3]" : "hover:bg-[#f3f7ff]",
      ].join(" ")}
      role="menuitem"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function parseBoardDocument(state: WhiteboardStateRow): BoardDocument {
  const raw = state.textContent.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<BoardDocument>;
      if (parsed.version === BOARD_VERSION && Array.isArray(parsed.objects)) {
        return {
          version: BOARD_VERSION,
          drawingDataUrl: typeof parsed.drawingDataUrl === "string" ? parsed.drawingDataUrl : "",
          objects: parsed.objects.filter(isBoardObject),
        };
      }
    } catch {
      return createDocumentFromLegacyText(state.textContent, state.canvasDataUrl);
    }
  }

  return {
    version: BOARD_VERSION,
    drawingDataUrl: state.canvasDataUrl,
    objects: [],
  };
}

function createDocumentFromLegacyText(text: string, canvasDataUrl: string): BoardDocument {
  return {
    version: BOARD_VERSION,
    drawingDataUrl: canvasDataUrl,
    objects: text.trim()
      ? [
          {
            id: createObjectId(),
            type: "text",
            text,
            x: 92,
            y: 84,
            width: 560,
            height: 180,
            fontSize: 42,
            color: "#171b26",
          },
        ]
      : [],
  };
}

function isBoardObject(value: unknown): value is BoardObject {
  if (!value || typeof value !== "object") return false;

  const object = value as Record<string, unknown>;
  const hasFrame =
    typeof object.id === "string" &&
    typeof object.x === "number" &&
    typeof object.y === "number" &&
    typeof object.width === "number" &&
    typeof object.height === "number";

  if (!hasFrame) return false;

  if (object.type === "image") {
    return typeof object.src === "string";
  }

  return (
    object.type === "text" &&
    typeof object.text === "string" &&
    typeof object.fontSize === "number" &&
    typeof object.color === "string"
  );
}

async function renderBoardPreview(document: BoardDocument) {
  const canvas = window.document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (document.drawingDataUrl) {
    const drawing = await loadImage(document.drawingDataUrl);
    context.drawImage(drawing, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  for (const object of document.objects) {
    if (object.type === "image") {
      const image = await loadImage(object.src);
      context.drawImage(image, object.x, object.y, object.width, object.height);
    } else {
      drawTextObject(context, object);
    }
  }

  return canvas.toDataURL("image/png");
}

function drawTextObject(context: CanvasRenderingContext2D, object: BoardTextObject) {
  const padding = 12;
  const lineHeight = object.fontSize * 1.22;
  const lines: string[] = [];

  context.save();
  context.fillStyle = object.color;
  context.font = `700 ${object.fontSize}px sans-serif`;
  context.textBaseline = "top";

  for (const paragraph of object.text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let currentLine = "";

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(candidate).width <= object.width - padding * 2) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  const maxLines = Math.floor((object.height - padding * 2) / lineHeight);
  lines.slice(0, Math.max(1, maxLines)).forEach((line, index) => {
    context.fillText(line, object.x + padding, object.y + padding + index * lineHeight);
  });

  context.restore();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

function createObjectId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `whiteboard-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSelectionBounds(start: Point, current: Point) {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);

  return {
    x,
    y,
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

function objectIntersectsBounds(object: BoardObject, bounds: ReturnType<typeof getSelectionBounds>) {
  return (
    object.x < bounds.x + bounds.width &&
    object.x + object.width > bounds.x &&
    object.y < bounds.y + bounds.height &&
    object.y + object.height > bounds.y
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatUpdatedAt(value: string) {
  if (!value || value === EMPTY_UPDATED_AT) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}

"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  Bold,
  Italic,
  Paperclip,
  Underline,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { BoardAttachment } from "@/lib/types";

const fontFamilies = [
  { label: "기본", value: "inherit" },
  { label: "Pretendard", value: "Pretendard, sans-serif" },
  { label: "맑은 고딕", value: "Malgun Gothic, sans-serif" },
  { label: "돋움", value: "Dotum, sans-serif" },
  { label: "궁서", value: "Gungsuh, serif" },
];

const fontSizes = [
  { label: "12", value: "2" },
  { label: "14", value: "3" },
  { label: "16", value: "4" },
  { label: "20", value: "5" },
  { label: "28", value: "6" },
];

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  function sync() {
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    sync();
  }

  function applyFontFamily(fontFamily: string) {
    if (fontFamily === "inherit") {
      runCommand("removeFormat");
      return;
    }

    runCommand("fontName", fontFamily);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#edf2f7] bg-[#f8fbff] p-2">
        <label className="sr-only" htmlFor="board-font-family">
          글꼴
        </label>
        <select
          id="board-font-family"
          className="h-8 rounded-md border border-[#cfd9e7] bg-white px-2 text-xs font-semibold text-[#22304f]"
          defaultValue="inherit"
          onChange={(event) => applyFontFamily(event.target.value)}
        >
          {fontFamilies.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="board-font-size">
          글자 크기
        </label>
        <select
          id="board-font-size"
          className="h-8 rounded-md border border-[#cfd9e7] bg-white px-2 text-xs font-semibold text-[#22304f]"
          defaultValue="3"
          onChange={(event) => runCommand("fontSize", event.target.value)}
        >
          {fontSizes.map((fontSize) => (
            <option key={fontSize.value} value={fontSize.value}>
              {fontSize.label}
            </option>
          ))}
        </select>
        <ToolbarButton label="굵게" onClick={() => runCommand("bold")}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="기울임" onClick={() => runCommand("italic")}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="밑줄" onClick={() => runCommand("underline")}>
          <Underline className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="글머리 목록" onClick={() => runCommand("insertUnorderedList")}>
          <span className="text-sm font-black leading-none">•</span>
        </ToolbarButton>
        <ToolbarButton label="번호 목록" onClick={() => runCommand("insertOrderedList")}>
          <span className="text-xs font-black leading-none">1.</span>
        </ToolbarButton>
      </div>
      <div
        id="board-content"
        ref={editorRef}
        role="textbox"
        aria-label="내용"
        contentEditable
        suppressContentEditableWarning
        className="min-h-[520px] px-4 py-4 text-sm leading-7 text-[#22304f] outline-none empty:before:text-[#94a3b8] empty:before:content-['내용을_입력하세요'] [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:ml-5 [&_ul]:list-disc"
        onInput={sync}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 rounded-md text-[#22304f] hover:bg-[#eaf1fd]"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function FilePicker({
  attachments,
  onChange,
}: {
  attachments: BoardAttachment[];
  onChange: (attachments: BoardAttachment[]) => void;
}) {
  async function handleFiles(files: FileList | null) {
    const nextAttachments = await readFiles(files);
    onChange([...attachments, ...nextAttachments]);
  }

  return (
    <div className="grid gap-2 rounded-lg border border-[#dbe4ef] bg-[#f8fbff] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-bold text-[#22304f]">첨부파일</Label>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#cfd9e7] bg-white px-3 text-sm font-semibold text-[#22304f] hover:bg-[#eef4fb]">
          <Paperclip className="size-4" />
          파일 추가
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {attachments.length > 0 ? (
        <div className="grid gap-1.5">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex min-w-0 items-center gap-2 rounded-md border border-[#dbe4ef] bg-white px-3 py-2 text-sm"
            >
              <Paperclip className="size-4 shrink-0 text-[#526079]" />
              <span className="min-w-0 flex-1 truncate font-medium text-[#22304f]">
                {attachment.name}
              </span>
              <span className="shrink-0 text-xs text-[#7a869b]">{formatBytes(attachment.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label="첨부파일 제거"
                onClick={() => onChange(attachments.filter((item) => item.id !== attachment.id))}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AttachmentList({
  attachments,
  compact = false,
}: {
  attachments: BoardAttachment[];
  compact?: boolean;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={compact ? "mt-2 grid gap-1.5" : "grid gap-2"}>
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.dataUrl}
          download={attachment.name}
          className="flex min-w-0 items-center gap-2 rounded-md border border-[#dbe4ef] bg-white px-3 py-2 text-sm font-medium text-[#22304f] hover:bg-[#f8fbff]"
        >
          <Paperclip className="size-4 shrink-0 text-[#526079]" />
          <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
          <span className="shrink-0 text-xs text-[#7a869b]">{formatBytes(attachment.size)}</span>
        </a>
      ))}
    </div>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const className =
    category === "공지"
      ? "border-[#f6c453] bg-[#fffbeb] text-[#9a6a00]"
      : category === "자료"
        ? "border-[#9ac4ff] bg-[#eff6ff] text-[#1f5fbf]"
        : category === "질문"
          ? "border-[#f1b5ca] bg-[#fff1f6] text-[#a43f68]"
          : "border-[#d8e0ea] bg-white text-[#526079]";

  return (
    <Badge variant="outline" className={`rounded ${className}`}>
      {category}
    </Badge>
  );
}

async function readFiles(files: FileList | null): Promise<BoardAttachment[]> {
  if (!files?.length) {
    return [];
  }

  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<BoardAttachment>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: createId(),
              name: file.name,
              size: file.size,
              type: file.type || "application/octet-stream",
              dataUrl: String(reader.result),
            });
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    ),
  );
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatBoardDate(value: string) {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.month}. ${parts.day}. ${parts.hour}:${parts.minute}`;
}

export function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeBoardHtml(value: string) {
  const allowedTags = new Set([
    "B",
    "BLOCKQUOTE",
    "BR",
    "DIV",
    "EM",
    "FONT",
    "I",
    "LI",
    "OL",
    "P",
    "S",
    "SPAN",
    "STRONG",
    "U",
    "UL",
  ]);
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?([a-z][a-z0-9]*)([^>]*)>/gi, (match, rawTagName, rawAttributes) => {
      const tagName = String(rawTagName).toUpperCase();
      const lowerTagName = tagName.toLowerCase();
      const isClosing = match.startsWith("</");

      if (!allowedTags.has(tagName)) {
        return "";
      }

      if (isClosing) {
        return `</${lowerTagName}>`;
      }

      if (tagName === "FONT") {
        const face = readAttribute(rawAttributes, "face");
        const size = readAttribute(rawAttributes, "size");
        const attributes = [
          face ? `face="${escapeHtml(face)}"` : "",
          size ? `size="${escapeHtml(size)}"` : "",
        ].filter(Boolean);

        return `<${lowerTagName}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
      }

      if (tagName === "SPAN") {
        const style = sanitizeStyle(readAttribute(rawAttributes, "style") ?? "");
        return `<span${style ? ` style="${escapeHtml(style)}"` : ""}>`;
      }

      return `<${lowerTagName}>`;
    });
}

function sanitizeStyle(value: string) {
  const allowedProperties = new Set([
    "background-color",
    "color",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "text-decoration",
  ]);

  return value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const [property, ...rawValue] = declaration.split(":");
      const normalizedProperty = property?.trim().toLowerCase();
      const normalizedValue = rawValue.join(":").trim().toLowerCase();

      return (
        allowedProperties.has(normalizedProperty) &&
        normalizedValue.length > 0 &&
        !normalizedValue.includes("url(") &&
        !normalizedValue.includes("expression(") &&
        !normalizedValue.includes("<")
      );
    })
    .join("; ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readAttribute(attributes: string, name: string) {
  const pattern = new RegExp(`${name}\\\\s*=\\\\s*(\"([^\"]*)\"|'([^']*)'|([^\\\\s>]+))`, "i");
  const match = attributes.match(pattern);

  return match?.[2] ?? match?.[3] ?? match?.[4] ?? null;
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'");
}

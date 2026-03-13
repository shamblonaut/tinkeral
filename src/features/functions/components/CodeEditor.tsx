import { useTheme } from "next-themes";
import {
  forwardRef,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import type { CodeEditorHandle, CodeEditorProps } from "../types";

// Lazy-loaded CodeMirror core — only fetched when CodeEditor mounts
const LazyEditorInner = lazy(() => import("./CodeEditorInner"));

/**
 * A lazily-loaded CodeMirror 6 editor for JavaScript/TypeScript code.
 *
 * The heavy CodeMirror bundle is fetched only when this component first
 * renders, keeping it out of the initial application bundle.
 *
 * Theme is automatically synced with the app's light/dark preference
 * via `next-themes`.
 */
const CodeEditor = memo(
  forwardRef<CodeEditorHandle, CodeEditorProps>(
    function CodeEditor(props, ref) {
      return (
        <Suspense fallback={<CodeEditorSkeleton className={props.className} />}>
          <LazyEditorInner ref={ref} {...props} />
        </Suspense>
      );
    },
  ),
);

export default CodeEditor;

// ---------------------------------------------------------------------------
// Inner component — loaded lazily via dynamic import
// ---------------------------------------------------------------------------

/** @internal Exported as the default from CodeEditorInner.tsx */
export const CodeEditorInnerImpl = memo(
  forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditorInner(
    { value = "", onChange, onBlur, placeholder, readOnly = false, className },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorViewType | null>(null);
    const onChangeRef = useRef(onChange);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    // Keep callback ref up to date without triggering re-creation
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Track whether the view has been initialised
    const [ready, setReady] = useState(false);

    // Store refs to compartments for reconfiguration
    const compartmentsRef = useRef<CompartmentRefs | null>(null);

    // Create editor on mount, destroy on unmount
    useEffect(() => {
      const parent = containerRef.current;
      if (!parent) return;

      let destroyed = false;

      void createEditor({
        parent,
        doc: value,
        isDark,
        readOnly,
        placeholder,
        onUpdate: (v) => onChangeRef.current?.(v),
      }).then(({ view, compartments }) => {
        if (destroyed) {
          view.destroy();
          return;
        }
        viewRef.current = view;
        compartmentsRef.current = compartments;
        setReady(true);
      });

      return () => {
        destroyed = true;
        viewRef.current?.destroy();
        viewRef.current = null;
        compartmentsRef.current = null;
        setReady(false);
      };
      // Intentionally only run on mount — value/theme changes are handled below
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync theme changes via compartment reconfiguration
    useEffect(() => {
      const view = viewRef.current;
      const compartments = compartmentsRef.current;
      if (!view || !compartments || !ready) return;

      void reconfigureTheme(view, compartments, isDark);
    }, [isDark, ready]);

    // Sync readOnly changes
    useEffect(() => {
      const view = viewRef.current;
      const compartments = compartmentsRef.current;
      if (!view || !compartments || !ready) return;

      void reconfigureReadOnly(view, compartments, readOnly);
    }, [readOnly, ready]);

    // Sync external value changes (e.g. form reset)
    useEffect(() => {
      const view = viewRef.current;
      if (!view || !ready) return;

      const current = view.state.doc.toString();
      if (current !== value) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
        });
      }
    }, [value, ready]);

    // Imperative handle for parent components
    const getValue = useCallback(() => {
      return viewRef.current?.state.doc.toString() ?? "";
    }, []);

    const focus = useCallback(() => {
      viewRef.current?.focus();
    }, []);

    useImperativeHandle(ref, () => ({ getValue, focus }), [getValue, focus]);

    return (
      <div
        ref={containerRef}
        onBlur={(e) => {
          // Fire onBlur only when focus truly leaves the editor container
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            onBlur?.();
          }
        }}
        className={cn("bg-background text-foreground overflow-auto", className)}
      />
    );
  }),
);
CodeEditorInnerImpl.displayName = "CodeEditorInner";

// ---------------------------------------------------------------------------
// Skeleton loader shown while CodeMirror JS is loading
// ---------------------------------------------------------------------------

function CodeEditorSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        "bg-muted/30 text-muted-foreground",
        className,
      )}
      style={{ minHeight: "150px" }}
    >
      <span className="animate-pulse text-sm">Loading editor…</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeMirror helpers — loaded dynamically alongside the inner component
// ---------------------------------------------------------------------------

// We import types only at the top-level so the module can still be
// tree-shaken when the component is never rendered.
import type { EditorView as EditorViewType } from "@codemirror/view";

interface CompartmentRefs {
  theme: InstanceType<typeof import("@codemirror/state").Compartment>;
  readOnly: InstanceType<typeof import("@codemirror/state").Compartment>;
}

async function loadCodeMirror() {
  const [
    {
      EditorView,
      crosshairCursor,
      drawSelection,
      dropCursor,
      highlightActiveLine,
      highlightActiveLineGutter,
      highlightSpecialChars,
      keymap,
      lineNumbers,
      placeholder: placeholderExt,
    },
    { EditorState, Compartment },
    { acceptCompletion, autocompletion, closeBrackets },
    { defaultKeymap, history, historyKeymap },
    { bracketMatching, defaultHighlightStyle, syntaxHighlighting },
    { javascript },
    { oneDark },
  ] = await Promise.all([
    import("@codemirror/view"),
    import("@codemirror/state"),
    import("@codemirror/autocomplete"),
    import("@codemirror/commands"),
    import("@codemirror/language"),
    import("@codemirror/lang-javascript"),
    import("@codemirror/theme-one-dark"),
  ]);
  return {
    EditorView,
    crosshairCursor,
    drawSelection,
    dropCursor,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    keymap,
    lineNumbers,
    placeholderExt,
    EditorState,
    Compartment,
    acceptCompletion,
    autocompletion,
    closeBrackets,
    defaultKeymap,
    history,
    historyKeymap,
    bracketMatching,
    defaultHighlightStyle,
    syntaxHighlighting,
    javascript,
    oneDark,
  };
}

let codeMirrorModulesPromise: ReturnType<typeof loadCodeMirror> | null = null;

async function getCodeMirrorModules() {
  if (!codeMirrorModulesPromise) {
    codeMirrorModulesPromise = loadCodeMirror();
  }
  return codeMirrorModulesPromise;
}

interface CreateEditorOpts {
  parent: HTMLElement;
  doc: string;
  isDark: boolean;
  readOnly: boolean;
  placeholder?: string;
  onUpdate: (value: string) => void;
}

async function createEditor({
  parent,
  doc,
  isDark,
  readOnly,
  placeholder,
  onUpdate,
}: CreateEditorOpts) {
  const cm = await getCodeMirrorModules();

  const themeCompartment = new cm.Compartment();
  const readOnlyCompartment = new cm.Compartment();

  const extensions = [
    cm.lineNumbers(),
    cm.highlightActiveLineGutter(),
    cm.highlightSpecialChars(),
    cm.history(),
    cm.drawSelection(),
    cm.dropCursor(),
    cm.EditorState.allowMultipleSelections.of(true),
    cm.syntaxHighlighting(cm.defaultHighlightStyle, { fallback: true }),
    cm.bracketMatching(),
    cm.closeBrackets(),
    cm.autocompletion(),
    cm.highlightActiveLine(),
    cm.crosshairCursor(),
    cm.keymap.of([
      {
        key: "Tab",
        run: cm.acceptCompletion,
      },
      ...cm.defaultKeymap,
      ...cm.historyKeymap,
    ]),
    cm.javascript({ jsx: true, typescript: true }),
    themeCompartment.of(isDark ? cm.oneDark : []),
    readOnlyCompartment.of(cm.EditorState.readOnly.of(readOnly)),
    cm.EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onUpdate(update.state.doc.toString());
      }
    }),
    // Base theme: make the editor fill its container and match app styles
    cm.EditorView.theme({
      "&": {
        height: "100%",
        fontSize: "14px",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: "'JetBrains Mono', Consolas, ui-monospace, monospace",
      },
      ".cm-gutters": {
        border: "none",
      },
      "&.cm-focused": {
        outline: "none",
      },
    }),
  ];

  if (placeholder) {
    extensions.push(cm.placeholderExt(placeholder));
  }

  const state = cm.EditorState.create({ doc, extensions });
  const view = new cm.EditorView({ state, parent });

  const compartments: CompartmentRefs = {
    theme: themeCompartment,
    readOnly: readOnlyCompartment,
  };

  return { view, compartments };
}

async function reconfigureTheme(
  view: EditorViewType,
  compartments: CompartmentRefs,
  isDark: boolean,
) {
  const cm = await getCodeMirrorModules();
  view.dispatch({
    effects: compartments.theme.reconfigure(isDark ? cm.oneDark : []),
  });
}

async function reconfigureReadOnly(
  view: EditorViewType,
  compartments: CompartmentRefs,
  readOnly: boolean,
) {
  const cm = await getCodeMirrorModules();
  view.dispatch({
    effects: compartments.readOnly.reconfigure(
      cm.EditorState.readOnly.of(readOnly),
    ),
  });
}

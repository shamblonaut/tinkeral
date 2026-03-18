import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import {
  bracketMatching,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import type { EditorView as EditorViewType } from "@codemirror/view";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { githubDarkInit, githubLightInit } from "@uiw/codemirror-theme-github";

// ---------------------------------------------------------------------------
// Types & Reusable State
// ---------------------------------------------------------------------------

export interface CompartmentRefs {
  theme: InstanceType<typeof Compartment>;
  readOnly: InstanceType<typeof Compartment>;
}

export interface CreateEditorOpts {
  parent: HTMLElement;
  doc: string;
  isDark: boolean;
  readOnly: boolean;
  placeholder?: string;
  onUpdate: (value: string) => void;
}

// ---------------------------------------------------------------------------
// Editor Setup
// ---------------------------------------------------------------------------

/**
 * Creates and mounts a new CodeMirror EditorView instance.
 * Returns the view and the compartments used for dynamic reconfiguration.
 */
export async function createEditor({
  parent,
  doc,
  isDark,
  readOnly,
  placeholder,
  onUpdate,
}: CreateEditorOpts) {
  // Compartments allow replacing extensions dynamically later
  const compartments: CompartmentRefs = {
    theme: new Compartment(),
    readOnly: new Compartment(),
  };

  const initialTheme = isDark ? githubDarkInit() : githubLightInit();

  const state = EditorState.create({
    doc,
    extensions: [
      // Basic Setup
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      highlightActiveLine(),
      crosshairCursor(),

      // Keymaps
      keymap.of([
        {
          key: "Tab",
          run: acceptCompletion,
        },
        ...defaultKeymap,
        ...historyKeymap,
      ]),

      // Language
      javascript({ typescript: true }),

      // Compartmentalized extensions
      compartments.theme.of(initialTheme),
      compartments.readOnly.of(EditorState.readOnly.of(readOnly)),

      // Optional placeholder
      ...(placeholder ? [placeholderExt(placeholder)] : []),

      // Listen for changes
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onUpdate(update.state.doc.toString());
        }
      }),
    ],
  });

  const view = new EditorView({
    state,
    parent,
  });

  return { view, compartments };
}

// ---------------------------------------------------------------------------
// Reconfiguration Helpers
// ---------------------------------------------------------------------------

export function reconfigureTheme(
  view: EditorViewType,
  compartments: CompartmentRefs,
  isDark: boolean,
) {
  const theme = isDark ? githubDarkInit() : githubLightInit();
  view.dispatch({
    effects: compartments.theme.reconfigure(theme),
  });
}

export function reconfigureReadOnly(
  view: EditorViewType,
  compartments: CompartmentRefs,
  readOnly: boolean,
) {
  view.dispatch({
    effects: compartments.readOnly.reconfigure(
      EditorState.readOnly.of(readOnly),
    ),
  });
}

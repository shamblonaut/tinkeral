import { create } from "zustand";

import { createChatSlice } from "./chatSlice";
import { createCoreSlice } from "./coreSlice";
import { createSearchSlice } from "./searchSlice";
import { createSelectionSlice } from "./selectionSlice";
import type { ConversationState } from "./types";

export const useConversationStore = create<ConversationState>()((...a) => ({
  ...createCoreSlice(...a),
  ...createSearchSlice(...a),
  ...createSelectionSlice(...a),
  ...createChatSlice(...a),
}));

import Dexie, { type Table } from "dexie";

import {
  type AppSettings,
  type Conversation,
  type FunctionDefinition,
} from "./schema";

export class TinkeralDatabase extends Dexie {
  conversations!: Table<Conversation>;
  settings!: Table<AppSettings>;
  functions!: Table<FunctionDefinition>;

  constructor() {
    super("TinkeralDatabase");
    this.version(1).stores({
      conversations: "id, title, modelId, updatedAt",
      settings: "id",
      functions: "id, name",
    });
  }
}

export const db = new TinkeralDatabase();

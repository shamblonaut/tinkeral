import { conversations as conversationsDb, type Conversation } from "@/db";

export class PersistenceService {
  /**
   * Canonical persistence entrypoint for conversation writes.
   * Returns true when a previously non-persisted conversation is newly persisted.
   */
  static async persistConversation(
    conversation: Conversation,
    options: {
      titleUpdate?: string;
      changes?: Partial<Conversation>;
    } = {},
  ): Promise<boolean> {
    if (conversation.isTemporary) return false;

    if (conversation.persisted === false) {
      return this.saveNewConversation(conversation, options.titleUpdate);
    }

    await this.updateConversation(conversation, options.changes);
    return false;
  }

  /**
   * Performs the initial save of a newly created conversation.
   */
  static async saveNewConversation(
    conversation: Conversation,
    titleUpdate?: string,
  ): Promise<boolean> {
    if (conversation.persisted !== false || conversation.isTemporary)
      return false;

    try {
      const {
        persisted: _persisted,
        isTemporary: _isTemporary,
        ...conversationData
      } = conversation;

      const persistedConversation = {
        ...conversationData,
        title: titleUpdate || conversation.title,
      };

      await conversationsDb.save(persistedConversation as Conversation);
      return true;
    } catch (error) {
      console.error("Failed to save new conversation:", error);
      return false;
    }
  }

  /**
   * Updates an existing persisted conversation.
   */
  static async updateConversation(
    conversation: Conversation,
    changes?: Partial<Conversation>,
  ) {
    if (conversation.persisted === false || conversation.isTemporary) return;

    const {
      persisted: _persisted,
      isTemporary: _isTemporary,
      ...conversationData
    } = conversation;

    try {
      await conversationsDb.update(conversation.id, {
        ...conversationData,
        ...changes,
      });
    } catch (error) {
      console.error("Failed to update conversation:", error);
    }
  }

  static async deleteConversationIfPersisted(
    conversation?: Pick<Conversation, "id" | "persisted">,
  ) {
    if (!conversation || conversation.persisted === false) {
      return;
    }

    await conversationsDb.delete(conversation.id);
  }

  static async deleteConversation(id: string, persisted?: boolean) {
    return this.deleteConversationIfPersisted(
      id ? { id, persisted } : undefined,
    );
  }

  static async renameConversation(
    conversation: Pick<Conversation, "id" | "isTemporary"> | undefined,
    title: string,
  ) {
    if (!conversation || conversation.isTemporary) {
      return;
    }

    await this.updateTitle(conversation.id, title);
  }

  static async updateTitle(id: string, title: string) {
    await conversationsDb.update(id, { title, updatedAt: Date.now() });
  }

  static async duplicateConversation(conversation: Conversation) {
    const newConversation: Omit<Conversation, "id"> = {
      ...conversation,
      title: `${conversation.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      persisted: true,
    };
    const newId = await conversationsDb.create(newConversation);
    return { ...newConversation, id: newId };
  }
}

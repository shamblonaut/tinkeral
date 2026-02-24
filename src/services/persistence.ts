import { conversations as conversationsDb, type Conversation } from "@/db";

export class PersistenceService {
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { persisted, isTemporary, ...conversationData } = conversation;

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

    try {
      await conversationsDb.update(conversation.id, {
        messages: conversation.messages,
        title: conversation.title,
        updatedAt: conversation.updatedAt,
        parameters: conversation.parameters,
        systemPrompt: conversation.systemPrompt,
        metadata: conversation.metadata,
        ...changes,
      });
    } catch (error) {
      console.error("Failed to update conversation:", error);
    }
  }

  static async deleteConversation(id: string, persisted?: boolean) {
    if (persisted !== false) {
      await conversationsDb.delete(id);
    }
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

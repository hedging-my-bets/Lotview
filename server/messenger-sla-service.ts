import { storage, type IStorage } from "./storage";
import { logInfo } from "./error-utils";

const DEFAULT_RESPONSE_MINUTES = 10;
const DEFAULT_REMINDER_MINUTES = 5;

function parseMinutes(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function getMessengerSlaConfig() {
  const responseMinutes = parseMinutes(
    process.env.MESSENGER_SLA_RESPONSE_MINUTES,
    DEFAULT_RESPONSE_MINUTES,
    1,
    120
  );
  const reminderFallback = Math.max(1, Math.round(responseMinutes / 2));
  const reminderMinutes = parseMinutes(
    process.env.MESSENGER_SLA_REMINDER_MINUTES,
    reminderFallback,
    1,
    responseMinutes
  );

  return { responseMinutes, reminderMinutes };
}

function formatPreview(text?: string | null, limit: number = 160): string {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, limit - 3)}...`;
}

export async function ensureMessengerResponseTask(params: {
  dealershipId: number;
  conversationId: number;
  assignedToUserId?: number | null;
  participantName?: string | null;
  pageName?: string | null;
  messagePreview?: string | null;
  storageOverride?: IStorage;
}): Promise<void> {
  const {
    dealershipId,
    conversationId,
    assignedToUserId,
    participantName,
    pageName,
    messagePreview,
    storageOverride,
  } = params;
  const storageClient = storageOverride ?? storage;
  const { responseMinutes, reminderMinutes } = getMessengerSlaConfig();
  const now = new Date();
  const dueAt = new Date(now.getTime() + responseMinutes * 60 * 1000);
  const reminderAt = new Date(now.getTime() + reminderMinutes * 60 * 1000);
  const leadName = participantName?.trim() || "Messenger lead";
  const pageLabel = pageName?.trim() || "Facebook";
  const preview = formatPreview(messagePreview);
  const title = `Reply to ${leadName}`;
  const descriptionParts = [`Messenger lead on ${pageLabel}.`];
  if (preview) {
    descriptionParts.push(`Latest: "${preview}"`);
  }
  const description = descriptionParts.join(" ");

  const activeTasks = await storageClient.getActiveMessengerSlaTasks(dealershipId, conversationId);
  if (activeTasks.length > 0) {
    for (const task of activeTasks) {
      await storageClient.updateCrmTask(task.id, dealershipId, {
        assignedToId: assignedToUserId ?? task.assignedToId ?? null,
        title,
        description,
        dueAt,
        reminderAt,
        priority: "high",
        status: "pending",
      });
    }
    return;
  }

  await storageClient.createCrmTask({
    dealershipId,
    assignedToId: assignedToUserId ?? null,
    createdById: null,
    title,
    description,
    taskType: "messenger-response",
    priority: "high",
    status: "pending",
    dueAt,
    reminderAt,
    aiGenerated: true,
    aiReason: "messenger_response_sla",
    messengerConversationId: conversationId,
  });
}

export async function completeMessengerResponseTasks(params: {
  dealershipId: number;
  conversationId: number;
  storageOverride?: IStorage;
}): Promise<void> {
  const { dealershipId, conversationId, storageOverride } = params;
  const storageClient = storageOverride ?? storage;
  const tasks = await storageClient.getActiveMessengerSlaTasks(dealershipId, conversationId);
  if (tasks.length === 0) return;
  const completedAt = new Date();

  for (const task of tasks) {
    await storageClient.updateCrmTask(task.id, dealershipId, {
      status: "completed",
      completedAt,
      reminderAt: null,
    });
  }
}

export async function reassignMessengerResponseTasks(params: {
  dealershipId: number;
  conversationId: number;
  assignedToUserId: number | null;
  storageOverride?: IStorage;
}): Promise<void> {
  const { dealershipId, conversationId, assignedToUserId, storageOverride } = params;
  const storageClient = storageOverride ?? storage;
  const tasks = await storageClient.getActiveMessengerSlaTasks(dealershipId, conversationId);
  if (tasks.length === 0) return;

  for (const task of tasks) {
    await storageClient.updateCrmTask(task.id, dealershipId, {
      assignedToId: assignedToUserId,
    });
  }
}

export async function processMessengerSlaAlerts(): Promise<void> {
  const broadcastNotification = (global as any).broadcastNotification as
    | ((dealershipId: number, payload: { type: "system"; title: string; message: string; data?: any; timestamp: string }) => void)
    | undefined;

  if (!broadcastNotification) return;

  const dealerships = await storage.getAllDealerships();
  const now = new Date();

  let reminderCount = 0;
  let overdueCount = 0;

  for (const dealership of dealerships) {
    const dealershipId = dealership.id;
    const reminders = await storage.getMessengerSlaTasksForReminder(dealershipId, now);
    for (const { task, conversation } of reminders) {
      const leadName = conversation?.participantName || "Messenger lead";
      const pageName = conversation?.pageName || "Facebook";
      const dueAt = task.dueAt ? new Date(task.dueAt) : null;
      const minutesRemaining = dueAt
        ? Math.max(0, Math.ceil((dueAt.getTime() - now.getTime()) / 60000))
        : null;
      const title = minutesRemaining !== null
        ? `Messenger reply due in ${minutesRemaining} min`
        : "Messenger reply due soon";
      const message = `${leadName} on ${pageName}.`;

      broadcastNotification(dealershipId, {
        type: "system",
        title,
        message,
        data: {
          taskId: task.id,
          conversationId: task.messengerConversationId,
          assignedToId: task.assignedToId,
          severity: "reminder",
        },
        timestamp: new Date().toISOString(),
      });

      await storage.updateCrmTask(task.id, dealershipId, {
        reminderAt: null,
        status: task.status === "pending" ? "in_progress" : task.status,
      });
      reminderCount += 1;
    }

    const overdueTasks = await storage.getMessengerSlaTasksOverdue(dealershipId, now);
    for (const { task, conversation } of overdueTasks) {
      if (task.priority === "urgent") {
        continue;
      }
      const leadName = conversation?.participantName || "Messenger lead";
      const pageName = conversation?.pageName || "Facebook";
      const dueAt = task.dueAt ? new Date(task.dueAt) : null;
      const minutesOverdue = dueAt
        ? Math.max(0, Math.ceil((now.getTime() - dueAt.getTime()) / 60000))
        : null;
      const title = minutesOverdue !== null
        ? `Messenger reply overdue by ${minutesOverdue} min`
        : "Messenger reply overdue";
      const message = `${leadName} on ${pageName}.`;

      broadcastNotification(dealershipId, {
        type: "system",
        title,
        message,
        data: {
          taskId: task.id,
          conversationId: task.messengerConversationId,
          assignedToId: task.assignedToId,
          severity: "overdue",
        },
        timestamp: new Date().toISOString(),
      });

      await storage.updateCrmTask(task.id, dealershipId, {
        priority: "urgent",
        reminderAt: null,
        status: task.status === "pending" ? "in_progress" : task.status,
      });
      overdueCount += 1;
    }
  }

  if (reminderCount > 0 || overdueCount > 0) {
    logInfo("Messenger SLA alerts processed", { reminderCount, overdueCount });
  }
}

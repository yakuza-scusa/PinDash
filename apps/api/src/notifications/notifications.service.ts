import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { database, NotificationType } from "@pindash/database";

@Injectable()
export class NotificationsService {
  list(userId: string) {
    return database.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  getPreferences(userId: string) {
    return database.user.findUniqueOrThrow({
      where: { id: userId },
      select: { notifyInApp: true, notifyByEmail: true },
    });
  }

  async markRead(userId: string, id: string) {
    const result = await database.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (!result.count) throw new NotFoundException("Notification not found");
    return { read: true };
  }

  async preferences(userId: string, inApp: boolean, email: boolean) {
    return database.user.update({
      where: { id: userId },
      data: { notifyInApp: inApp, notifyByEmail: email },
      select: { notifyInApp: true, notifyByEmail: true },
    });
  }

  static async notifyWorkspace(input: {
    workspaceId: string;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }) {
    const members = await database.workspaceMember.findMany({
      where: { workspaceId: input.workspaceId, user: { notifyInApp: true } },
      select: { userId: true },
    });
    if (!members.length) return;
    await database.notification.createMany({
      data: members.map(({ userId }) => ({ ...input, userId })),
    });
  }

  async requireWorkspace(userId: string, workspaceId: string) {
    const member = await database.workspaceMember.count({
      where: { userId, workspaceId },
    });
    if (!member) throw new ForbiddenException("Workspace access denied");
  }
}

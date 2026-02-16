import { ThreadChannel, ChannelType } from 'discord.js';
import { logger } from '../utils/logger';
import { LogArea } from '../types/logger';
import { ERROR_CODES } from '../config/constants';

export interface ThreadArchiveState {
  wasArchived: boolean | null;
  wasLocked: boolean | null;
  autoArchiveDuration: number;
}

export class ThreadArchiveService {
  isThread(channel: any): boolean {
    return [
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.AnnouncementThread
    ].includes(channel.type);
  }

  isArchivedThread(channel: any): boolean {
    return this.isThread(channel) && channel.archived === true;
  }

  captureState(thread: ThreadChannel): ThreadArchiveState {
    return {
      wasArchived: thread.archived,
      wasLocked: thread.locked,
      autoArchiveDuration: thread.autoArchiveDuration || 60
    };
  }

  async unarchive(thread: ThreadChannel): Promise<boolean> {
    if (!thread.archived) return true;

    try {
      await thread.setArchived(false, 'Unarchiving for purge operation');
      return true;
    } catch (error: any) {
      if (error.code === ERROR_CODES.MISSING_ACCESS) {
        logger.warning(LogArea.PURGE, `Missing permission to unarchive thread: ${thread.name}`);
      } else if (error.code === ERROR_CODES.UNKNOWN_CHANNEL) {
        logger.warning(LogArea.PURGE, `Thread no longer exists: ${thread.name}`);
      } else {
        logger.error(LogArea.PURGE, `Failed to unarchive thread ${thread.name}: ${error.message}`);
      }
      return false;
    }
  }

  async restoreState(thread: ThreadChannel, state: ThreadArchiveState): Promise<void> {
    if (!state.wasArchived) return;

    try {
      await thread.setArchived(true, 'Restoring archive state after purge');
    } catch (error: any) {
      logger.warning(LogArea.PURGE, `Failed to re-archive thread ${thread.name}: ${error.message}`);
    }
  }
}

export const threadArchiveService = new ThreadArchiveService();

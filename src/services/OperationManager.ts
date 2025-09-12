import { CommandInteraction } from "discord.js";
import { OperationState } from "../types";

export class OperationManager {
  private operations: Map<string, OperationState> = new Map();
  private guildLocks: Map<string, string> = new Map(); // guildId -> operationId

  createOperation(interaction: CommandInteraction, guildId: string): string {
    const operationId = `${guildId}-${Date.now()}`;
    
    const operation: OperationState = {
      id: operationId,
      guildId,
      cancelled: false,
      startTime: Date.now(),
      interaction
    };
    
    this.operations.set(operationId, operation);
    this.guildLocks.set(guildId, operationId);
    
    return operationId;
  }

  isGuildLocked(guildId: string): boolean {
    const existingOpId = this.guildLocks.get(guildId);
    if (!existingOpId) return false;
    
    const operation = this.operations.get(existingOpId);
    return operation !== undefined && !operation.cancelled;
  }

  cancelOperation(operationId: string): boolean {
    const operation = this.operations.get(operationId);
    if (!operation) return false;
    
    operation.cancelled = true;
    return true;
  }

  isOperationCancelled(operationId: string): boolean {
    const operation = this.operations.get(operationId);
    return operation?.cancelled ?? true;
  }

  completeOperation(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) return;
    
    this.operations.delete(operationId);
    this.guildLocks.delete(operation.guildId);
  }

  getOperation(operationId: string): OperationState | undefined {
    return this.operations.get(operationId);
  }

  getActiveOperationForGuild(guildId: string): OperationState | undefined {
    const operationId = this.guildLocks.get(guildId);
    if (!operationId) return undefined;
    return this.operations.get(operationId);
  }
}

export const operationManager = new OperationManager();
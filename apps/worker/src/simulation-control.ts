/**
 * Simulation Control State - Persistent Control Flags
 *
 * @module worker/simulation-control
 *
 * ## Purpose
 * Manages persistent control flags that pause bots or stop processing entirely.
 * Provides a safety layer for external intervention without code changes or deployments.
 *
 * ## Architecture Role
 * Safety and control layer that enables:
 * - Emergency stop of simulation processing
 * - Selective bot pause (while other systems continue)
 * - Tracking of invariant violation incidents
 * - External control without worker restart
 *
 * ## Control Flags
 * ### botsPaused
 * - When true: Bot execution disabled (bots don't place orders or start production)
 * - Other systems continue: Production completion, market matching, shipments, etc.
 * - Use case: Stop bot activity while investigating anomalies
 * - Set automatically on invariant violations (if configured)
 *
 * ### processingStopped
 * - When true: All tick processing halts (worker becomes idle)
 * - Use case: Emergency stop for critical issues or maintenance
 * - Set automatically on critical invariant violations (if configured)
 * - Requires manual intervention to resume
 *
 * ## Key Operations
 * - **ensureSimulationControlState**: Reads current control state (creates if missing)
 * - **pauseBotsAfterInvariantViolation**: Sets botsPaused=true, records violation metadata
 * - **stopSimulationAfterInvariantViolation**: Sets both flags, records violation metadata
 *
 * ## State Persistence
 * - Stored in `simulationControlState` table (singleton record, id=1)
 * - Survives worker restarts and deployments
 * - Upsert operations are idempotent (safe for concurrent calls)
 * - Tracks last violation tick and timestamp for debugging
 *
 * ## Integration with Queue Runtime
 * - Checked before each job execution
 * - If `processingStopped`, job returns immediately without processing
 * - If `botsPaused`, bots skipped but other subsystems run
 * - Updated automatically after invariant scans (based on config)
 *
 * ## Manual Control
 * External tools can update control state via database or API:
 * ```sql
 * UPDATE simulation_control_state SET bots_paused = false WHERE id = 1;
 * UPDATE simulation_control_state SET processing_stopped = false WHERE id = 1;
 * ```
 *
 * ## Use Cases
 * - **Emergency stop**: Critical bug detected, halt all processing
 * - **Bot pause**: Suspicious market activity, disable bots temporarily
 * - **Investigation**: Freeze state while analyzing logs/data
 * - **Maintenance**: Safe window for schema changes or data fixes
 * - **Gradual resume**: Clear `botsPaused` first, then `processingStopped`
 *
 * ## Error Handling
 * - Upsert operations are idempotent (no explicit error handling needed)
 * - Database constraint ensures singleton (id=1)
 * - Missing record created automatically on first access
 */
import { PrismaClient } from "@prisma/client";

export interface SimulationControlSnapshot {
  botsPaused: boolean;
  processingStopped: boolean;
}

export async function ensureSimulationControlState(
  prisma: PrismaClient
): Promise<SimulationControlSnapshot> {
  const state = await prisma.simulationControlState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      botsPaused: false,
      processingStopped: false
    },
    update: {},
    select: {
      botsPaused: true,
      processingStopped: true
    }
  });

  return state;
}

export async function pauseBotsAfterInvariantViolation(
  prisma: PrismaClient,
  tick: number
): Promise<void> {
  await prisma.simulationControlState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      botsPaused: true,
      processingStopped: false,
      lastInvariantViolationTick: tick,
      lastInvariantViolationAt: new Date()
    },
    update: {
      botsPaused: true,
      lastInvariantViolationTick: tick,
      lastInvariantViolationAt: new Date()
    }
  });
}

export async function stopSimulationAfterInvariantViolation(
  prisma: PrismaClient,
  tick: number
): Promise<void> {
  await prisma.simulationControlState.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      botsPaused: true,
      processingStopped: true,
      lastInvariantViolationTick: tick,
      lastInvariantViolationAt: new Date()
    },
    update: {
      botsPaused: true,
      processingStopped: true,
      lastInvariantViolationTick: tick,
      lastInvariantViolationAt: new Date()
    }
  });
}

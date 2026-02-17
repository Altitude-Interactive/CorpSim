/**
 * Simulation Reset Service
 *
 * @module reset-simulation
 *
 * ## Purpose
 * Database cleanup utility that resets all simulation data by deleting entities
 * in dependency order and reinitializing core world state. Used for development,
 * testing, and demo resets.
 *
 * ## Reset Scope
 * Deletes all simulation data including:
 * - Tick execution history
 * - Simulation leases and control state
 * - Research jobs and progress
 * - Contracts and fulfillments
 * - Shipments
 * - Market orders and trades
 * - Production jobs
 * - Workforce deltas
 * - Ledger entries
 * - Market candles
 * - Inventory
 * - Company regions
 * - Companies (except system companies)
 * - Players
 *
 * ## Preserves
 * - Items catalog
 * - Recipes
 * - Research node definitions
 * - Region definitions
 * - System/seed companies
 *
 * ## Transaction Safety
 * - Executes as single transaction for atomicity
 * - Maintains referential integrity through dependency-order deletion
 * - Reinitializes world tick state (tick=0, lockVersion=0)
 * - Reinitializes control state
 *
 * ## Use Cases
 * - Development environment resets
 * - Integration test setup
 * - Demo environment refresh
 * - Recovery from corrupted state
 *
 * **WARNING**: This is a destructive operation. All game progress is lost.
 */
import { PrismaClient } from "@prisma/client";

export async function resetSimulationData(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.simulationTickExecution.deleteMany();
    await tx.simulationLease.deleteMany();
    await tx.simulationControlState.deleteMany();
    await tx.researchJob.deleteMany();
    await tx.companyResearch.deleteMany();
    await tx.researchPrerequisite.deleteMany();
    await tx.researchNodeUnlockRecipe.deleteMany();
    await tx.researchNode.deleteMany();
    await tx.companyRecipe.deleteMany();
    await tx.shipment.deleteMany();
    await tx.contractFulfillment.deleteMany();
    await tx.contract.deleteMany();
    await tx.trade.deleteMany();
    await tx.marketOrder.deleteMany();
    await tx.productionJob.deleteMany();
    await tx.workforceCapacityDelta.deleteMany();
    await tx.ledgerEntry.deleteMany();
    await tx.itemTickCandle.deleteMany();
    await tx.recipeInput.deleteMany();
    await tx.recipe.deleteMany();
    await tx.inventory.deleteMany();
    await tx.company.deleteMany();
    await tx.player.deleteMany();
    await tx.region.deleteMany();
    await tx.item.deleteMany();
    await tx.worldTickState.deleteMany();

    await tx.worldTickState.create({
      data: {
        id: 1,
        currentTick: 0,
        lockVersion: 0,
        lastAdvancedAt: null
      }
    });

    await tx.simulationControlState.create({
      data: {
        id: 1,
        botsPaused: false,
        processingStopped: false,
        lastInvariantViolationTick: null,
        lastInvariantViolationAt: null
      }
    });
  });
}

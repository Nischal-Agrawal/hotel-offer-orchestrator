import { proxyActivities, log, ApplicationFailure, defineQuery, defineSignal, setHandler } from '@temporalio/workflow';
import type * as activities from './activities.js';
import { ACTIVITY_TIMEOUTS } from './constants.js';
import { WorkflowInput, WorkflowResult, HotelOffer } from '../domain/types.js';
import { deduplicateHotelOffers, TaggedOffer } from '../domain/deduplicate.js';

export const getExecutionStatusQuery = defineQuery<{
  status: 'initializing' | 'fetching' | 'deduplicating' | 'completed' | 'failed';
  city: string;
  offersCount: number;
}>('getExecutionStatus');

export const cancelWorkflowSignal = defineSignal('cancelWorkflow');

const { fetchSupplierAHotels, fetchSupplierBHotels, cacheHotelOffersInRedis } =
  proxyActivities<typeof activities>(ACTIVITY_TIMEOUTS);

/**
 * Deterministic Temporal Workflow to orchestrate hotel offers aggregation,
 * parallel fetching, deduplication, fault tolerance, and Redis caching.
 */
export async function hotelSearchWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const city = input.city.trim().toLowerCase();
  let workflowPhase: 'initializing' | 'fetching' | 'deduplicating' | 'completed' | 'failed' = 'initializing';
  let totalOffers = 0;
  let isCancelled = false;

  setHandler(getExecutionStatusQuery, () => ({
    status: workflowPhase,
    city,
    offersCount: totalOffers,
  }));

  setHandler(cancelWorkflowSignal, () => {
    isCancelled = true;
    log.warn(`Received cancel signal for city: ${city}`);
  });

  workflowPhase = 'fetching';
  log.info(`Starting hotel search workflow for city: ${city}`);

  // Fetch both suppliers in parallel
  const [resultA, resultB] = await Promise.allSettled([
    fetchSupplierAHotels(city),
    fetchSupplierBHotels(city),
  ]);

  if (isCancelled) {
    throw ApplicationFailure.nonRetryable(`Workflow cancelled for city '${city}'`, 'WORKFLOW_CANCELLED');
  }

  const taggedOffers: TaggedOffer[] = [];
  const degradedSuppliers: string[] = [];

  if (resultA.status === 'fulfilled') {
    for (const offer of resultA.value) {
      taggedOffers.push({ offer, supplierName: 'Supplier A' });
    }
  } else {
    log.warn(`Supplier A failed for city ${city}: ${resultA.reason}`);
    degradedSuppliers.push('Supplier A');
  }

  if (resultB.status === 'fulfilled') {
    for (const offer of resultB.value) {
      taggedOffers.push({ offer, supplierName: 'Supplier B' });
    }
  } else {
    log.warn(`Supplier B failed for city ${city}: ${resultB.reason}`);
    degradedSuppliers.push('Supplier B');
  }

  // If both suppliers fail, throw an ApplicationFailure
  if (resultA.status === 'rejected' && resultB.status === 'rejected') {
    workflowPhase = 'failed';
    log.error(`Both suppliers failed for city: ${city}`);
    throw ApplicationFailure.nonRetryable(
      `Both suppliers failed to provide hotel offers for city '${city}'`,
      'ALL_SUPPLIERS_UNAVAILABLE'
    );
  }

  // Pure deterministic deduplication and best offer selection
  workflowPhase = 'deduplicating';
  const offers: HotelOffer[] = deduplicateHotelOffers(taggedOffers);
  totalOffers = offers.length;
  log.info(`Deduplicated to ${offers.length} best offers for city: ${city}`);

  // Persist deduplicated offers into Redis
  await cacheHotelOffersInRedis(city, offers, degradedSuppliers);
  log.info(`Successfully cached offers in Redis for city: ${city}`);

  workflowPhase = 'completed';
  return {
    city,
    offers,
    degradedSuppliers,
  };
}

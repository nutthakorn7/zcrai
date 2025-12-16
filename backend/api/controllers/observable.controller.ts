import { Elysia } from 'elysia';
import { withAuth } from '../middleware/auth';
import { ObservableService } from '../core/services/observable.service';
import { Errors } from '../middleware/error';

export const observableController = new Elysia({ prefix: '/observables' })
  .use(withAuth)
  
  // List observables
  .get('/', async ({ query, user }: any) => {
    const observables = await ObservableService.list({
      tenantId: user.tenantId,
      type: query.type ? query.type.split(',') : undefined,
      caseId: query.caseId,
      alertId: query.alertId,
      isMalicious: query.isMalicious === 'true' ? true : query.isMalicious === 'false' ? false : undefined,
      search: query.search,
      limit: query.limit ? parseInt(query.limit) : 100,
      offset: query.offset ? parseInt(query.offset) : 0,
    });

    return { success: true, data: observables };
  })

  // Create observable manually
  .post('/', async ({ body, user }: any) => {
    const observable = await ObservableService.create({
      tenantId: user.tenantId,
      ...body,
    });

    return { success: true, data: observable };
  })

  // Extract IOCs from text
  .post('/extract', async ({ body, user }: any) => {
    const observables = await ObservableService.extract(
      body.text,
      user.tenantId,
      body.caseId,
      body.alertId
    );

    return { success: true, data: observables };
  })

  // Get observable by ID
  .get('/:id', async ({ params, user }: any) => {
    const observable = await ObservableService.getById(params.id, user.tenantId);
    if (!observable) throw Errors.NotFound('Observable');

    return { success: true, data: observable };
  })

  // Trigger enrichment
  .patch('/:id/enrich', async ({ params, user }: any) => {
    const result = await ObservableService.enrich(params.id, user.tenantId);
    return { success: true, data: result };
  })

  // Get sightings
  .get('/:id/sightings', async ({ params, user }: any) => {
    const sightings = await ObservableService.getSightings(params.id, user.tenantId);
    return { success: true, data: sightings };
  })

  // Set malicious status
  .patch('/:id/status', async ({ params, body, user }: any) => {
    const observable = await ObservableService.setMaliciousStatus(
      params.id,
      user.tenantId,
      body.isMalicious
    );

    return { success: true, data: observable };
  })

  // Add tag
  .post('/:id/tags', async ({ params, body, user }: any) => {
    const observable = await ObservableService.addTag(
      params.id,
      user.tenantId,
      body.tag
    );

    return { success: true, data: observable };
  })

  // Remove tag
  .delete('/:id/tags/:tag', async ({ params, user }: any) => {
    const observable = await ObservableService.removeTag(
      params.id,
      user.tenantId,
      params.tag
    );

    return { success: true, data: observable };
  })

  // Delete observable
  .delete('/:id', async ({ params, user }: any) => {
    const result = await ObservableService.delete(params.id, user.tenantId);
    return { success: true, data: result };
  });

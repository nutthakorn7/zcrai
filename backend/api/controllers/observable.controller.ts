import { Elysia } from 'elysia';
import { withAuth } from '../middleware/auth';
import { ObservableService } from '../core/services/observable.service';
import { Errors } from '../middleware/error';

export const observableController = new Elysia({ prefix: '/observables' })
  .use(withAuth)
  
  /**
   * List all observables (IOCs) with optional filtering
   * @route GET /observables
   * @access Protected - Requires authentication
   * @query {string} type - Filter by type (ip, domain, hash, email, url) - comma-separated
   * @query {string} caseId - Filter by case ID
   * @query {string} alertId - Filter by alert ID
   * @query {boolean} isMalicious - Filter by malicious status
   * @query {string} search - Search term
   * @query {number} limit - Max results (default: 100)
   * @query {number} offset - Pagination offset (default: 0)
   * @returns {Object} List of observables (IOCs)
   */
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

  /**
   * Manually create/add an observable (IOC)
   * @route POST /observables
   * @access Protected - Requires authentication
   * @body {string} type - Observable type (ip, domain, hash, etc.)
   * @body {string} value - Observable value
   * @body {boolean} isMalicious - Whether this is known malicious
   * @returns {Object} Created observable
   */
  .post('/', async ({ body, user }: any) => {
    const observable = await ObservableService.create({
      tenantId: user.tenantId,
      ...body,
    });

    return { success: true, data: observable };
  })

  /**
   * Extract IOCs automatically from text/logs
   * @route POST /observables/extract
   * @access Protected - Requires authentication
   * @body {string} text - Text to extract IOCs from
   * @body {string} caseId - Associate with case (optional)
   * @body {string} alertId - Associate with alert (optional)
   * @returns {Object} List of extracted observables
   */
  .post('/extract', async ({ body, user }: any) => {
    const observables = await ObservableService.extract(
      body.text,
      user.tenantId,
      body.caseId,
      body.alertId
    );

    return { success: true, data: observables };
  })

  /**
   * Get detailed information about a specific observable
   * @route GET /observables/:id
   * @access Protected - Requires authentication
   * @param {string} id - Observable ID
   * @returns {Object} Observable details with enrichment data
   * @throws {404} Observable not found
   */
  .get('/:id', async ({ params, user }: any) => {
    const observable = await ObservableService.getById(params.id, user.tenantId);
    if (!observable) throw Errors.NotFound('Observable');

    return { success: true, data: observable };
  })

  /**
   * Trigger enrichment for an observable (threat intel lookup)
   * @route PATCH /observables/:id/enrich
   * @access Protected - Requires authentication
   * @param {string} id - Observable ID
   * @returns {Object} Enriched observable data from threat feeds
   */
  .patch('/:id/enrich', async ({ params, user }: any) => {
    const result = await ObservableService.enrich(params.id, user.tenantId);
    return { success: true, data: result };
  })

  /**
   * Get sightings/occurrences of this observable across logs
   * @route GET /observables/:id/sightings
   * @access Protected - Requires authentication
   * @param {string} id - Observable ID
   * @returns {Object} List of sightings with timestamps
   */
  .get('/:id/sightings', async ({ params, user }: any) => {
    const sightings = await ObservableService.getSightings(params.id, user.tenantId);
    return { success: true, data: sightings };
  })

  /**
   * Update malicious status of an observable
   * @route PATCH /observables/:id/status
   * @access Protected - Requires authentication
   * @param {string} id - Observable ID
   * @body {boolean} isMalicious - Mark as malicious or benign
   * @returns {Object} Updated observable
   */
  .patch('/:id/status', async ({ params, body, user }: any) => {
    const observable = await ObservableService.setMaliciousStatus(
      params.id,
      user.tenantId,
      body.isMalicious
    );

    return { success: true, data: observable };
  })

  /**
   * Add a tag to an observable for categorization
   * @route POST /observables/:id/tags
   * @access Protected - Requires authentication
   * @param {string} id - Observable ID
   * @body {string} tag - Tag to add
   * @returns {Object} Updated observable with new tag
   */
  .post('/:id/tags', async ({ params, body, user }: any) => {
    const observable = await ObservableService.addTag(
      params.id,
      user.tenantId,
      body.tag
    );

    return { success: true, data: observable };
  })

  /**
   * Remove a tag from an observable
   * @route DELETE /observables/:id/tags/:tag
   * @access Protected - Requires authentication
   * @param {string} id - Observable ID
   * @param {string} tag - Tag to remove
   * @returns {Object} Updated observable without the tag
   */
  .delete('/:id/tags/:tag', async ({ params, user }: any) => {
    const observable = await ObservableService.removeTag(
      params.id,
      user.tenantId,
      params.tag
    );

    return { success: true, data: observable };
  })

  /**
   * Delete an observable from the database
   * @route DELETE /observables/:id
   * @access Protected - Requires authentication
   * @param {string} id - Observable ID
   * @returns {Object} Success message
   */
  .delete('/:id', async ({ params, user }: any) => {
    const result = await ObservableService.delete(params.id, user.tenantId);
    return { success: true, data: result };
  });

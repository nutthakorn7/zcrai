import { Elysia, t } from 'elysia';
import { withAuth } from '../middleware/auth';
import { Errors } from '../middleware/error';
import { CustomWidgetService, WidgetConfig, CreateWidgetInput } from '../core/services/custom-widget.service';

const WidgetConfigSchema = t.Object({
  metric: t.Union([t.Literal('events'), t.Literal('alerts')]),
  aggregation: t.Union([t.Literal('count'), t.Literal('unique')]),
  groupBy: t.Union([
    t.Literal('severity'),
    t.Literal('source'),
    t.Literal('host'),
    t.Literal('user'),
    t.Literal('day')
  ]),
  timeRange: t.Union([
    t.Literal('1d'),
    t.Literal('7d'),
    t.Literal('30d'),
    t.Literal('90d')
  ]),
  filters: t.Optional(t.Object({
    severity: t.Optional(t.Array(t.String())),
    source: t.Optional(t.Array(t.String()))
  }))
});

const CreateWidgetSchema = t.Object({
  name: t.String(),
  description: t.Optional(t.String()),
  config: WidgetConfigSchema,
  chartType: t.Union([
    t.Literal('bar'),
    t.Literal('line'),
    t.Literal('pie'),
    t.Literal('donut'),
    t.Literal('table')
  ])
});

export const widgetController = new Elysia({ prefix: '/widgets' })
  .use(withAuth)
  
  // Preview query (execute widget config without saving)
  .post('/query', async ({ body, user }: any) => {
    const data = await CustomWidgetService.executeQuery(user.tenantId, body as WidgetConfig);
    return { success: true, data };
  }, { body: WidgetConfigSchema })

  // Create widget
  .post('/', async ({ body, user }: any) => {
    const widget = await CustomWidgetService.create(
      user.id,
      user.tenantId,
      body as CreateWidgetInput
    );
    return { success: true, data: widget };
  }, { body: CreateWidgetSchema })

  // List user widgets
  .get('/', async ({ user }: any) => {
    const widgets = await CustomWidgetService.list(user.id, user.tenantId);
    return { success: true, data: widgets };
  })

  // Get widget by ID
  .get('/:id', async ({ params, user }: any) => {
    const widget = await CustomWidgetService.getById(params.id, user.tenantId);
    if (!widget) throw Errors.NotFound('Widget');
    return { success: true, data: widget };
  })

  // Delete widget
  .delete('/:id', async ({ params, user }: any) => {
    await CustomWidgetService.delete(params.id, user.id);
    return { success: true };
  });

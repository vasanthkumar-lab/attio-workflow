import { BadRequestException } from '@nestjs/common';
import { validateCondition } from '../common/conditions';
import { Events } from '../common/events';

const TRIGGERS = [...Object.values(Events), 'manual'];
const STEP_TYPES = ['enrich', 'score', 'if', 'update', 'addTag', 'enroll', 'webhook'];

function validateSteps(steps: any, path: string): string | null {
  if (!Array.isArray(steps)) return `${path} must be an array`;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i], p = `${path}[${i}]`;
    if (!STEP_TYPES.includes(s?.type)) return `${p}.type must be one of ${STEP_TYPES.join(', ')}`;
    switch (s.type) {
      case 'score':
        if (!Array.isArray(s.rules) || !s.rules.length) return `${p}.rules must be a non-empty array`;
        for (let j = 0; j < s.rules.length; j++) {
          if (typeof s.rules[j]?.points !== 'number') return `${p}.rules[${j}].points must be a number`;
          const err = validateCondition(s.rules[j].condition, `${p}.rules[${j}].condition`);
          if (err) return err;
        }
        break;
      case 'if': {
        const err = validateCondition(s.condition, `${p}.condition`) ?? validateSteps(s.then, `${p}.then`) ?? (s.else ? validateSteps(s.else, `${p}.else`) : null);
        if (err) return err;
        break;
      }
      case 'update':
        if (!s.fields || typeof s.fields !== 'object') return `${p}.fields must be an object`;
        break;
      case 'addTag':
        if (typeof s.tag !== 'string' || !s.tag) return `${p}.tag is required`;
        break;
      case 'enroll':
        if (typeof s.sequenceId !== 'string' || !s.sequenceId) return `${p}.sequenceId is required`;
        break;
      case 'webhook':
        if (typeof s.url !== 'string' || !/^https:\/\//.test(s.url)) return `${p}.url must be an https URL`;
        break;
    }
  }
  return null;
}

export function validateWorkflowInput(input: any): void {
  const fail = (msg: string) => { throw new BadRequestException(msg); };
  if (!input || typeof input !== 'object') fail('body must be a JSON object');
  if (typeof input.name !== 'string' || !input.name.trim()) fail('name is required');
  if (!TRIGGERS.includes(input.trigger?.event)) fail(`trigger.event must be one of ${TRIGGERS.join(', ')}`);
  if (input.trigger.condition) {
    const err = validateCondition(input.trigger.condition, 'trigger.condition');
    if (err) fail(err);
  }
  if (!Array.isArray(input.steps) || !input.steps.length) fail('steps must contain at least one step');
  const err = validateSteps(input.steps, 'steps');
  if (err) fail(err);
}
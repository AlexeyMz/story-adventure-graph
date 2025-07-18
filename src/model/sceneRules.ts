import * as Reactodia from '@reactodia/workspace';

import { app, rdf, rdfs, xsd } from './vocabulary';

export function makeSceneSchema(factory: Reactodia.Rdf.DataFactory): Reactodia.Rdf.Quad[] {
  const quads: Reactodia.Rdf.Quad[] = [];

  const typePredicate = factory.namedNode(rdf.type);
  const classType = factory.namedNode(rdfs.Class);

  quads.push(
    factory.quad(factory.namedNode(app.Scene), typePredicate, classType)
  );

  return quads;
}

export interface SceneRule {
  readonly current_scene: string;
  readonly result_scene: string;
  readonly weight: number;
  readonly params: readonly SceneRuleCondition[];
}

export interface SceneRuleCondition {
  readonly name: string;
  readonly operator: 'GT' | 'LT' | 'EQ' | 'GE' | 'LE';
  readonly value: number;
}

export function rulesIntoQuads(rules: readonly SceneRule[], factory: Reactodia.Rdf.DataFactory): Reactodia.Rdf.Quad[] {
  const quads: Reactodia.Rdf.Quad[] = [];

  const scenes = new Set<string>();
  for (const rule of rules) {
    scenes.add(rule.current_scene);
    scenes.add(rule.result_scene);
  }

  const typePredicate = factory.namedNode(rdf.type);
  const sceneType = factory.namedNode(app.Scene);

  for (const scene of scenes) {
    quads.push(factory.quad(
      factory.namedNode(sceneIri(scene)),
      typePredicate,
      sceneType
    ));
  }

  const conditionPredicate = factory.namedNode(app.condition);
  const toPredicate = factory.namedNode(app.to);
  const weightPredicate = factory.namedNode(app.weight);

  for (const rule of rules) {
    const ruleQuad = factory.quad(
      factory.namedNode(sceneIri(rule.current_scene)),
      toPredicate,
      factory.namedNode(sceneIri(rule.result_scene))
    );
    quads.push(ruleQuad);
    if (rule.weight !== 1) {
      quads.push(factory.quad(
        ruleQuad, weightPredicate, factory.literal(String(rule.weight), xsd.double)
      ));
    }
    for (const param of rule.params) {
      const condition = serializeCondition(param, factory);
      quads.push(factory.quad(ruleQuad, conditionPredicate, condition));
    }
  }

  return quads;
}

export function serializeCondition(
  condition: SceneRuleCondition,
  factory: Reactodia.Rdf.DataFactory
): Reactodia.Rdf.Literal {
  const operator = (
    condition.operator === 'EQ' ? '=' :
    condition.operator === 'GT' ? '>' :
    condition.operator === 'GE' ? '>=' :
    condition.operator === 'LT' ? '<' :
    condition.operator === 'LE' ? '<=' :
    condition.operator
  );
  return factory.literal(
    `${condition.name} ${operator} ${condition.value}`,
    factory.namedNode(app.RuleCondition)
  );
}

export function deserializeCondition(
  expression: Reactodia.Rdf.Literal
): SceneRuleCondition {
  const match = /^([^\s]+)\s+([^\s]+)\s+([^\s]+)$/.exec(expression.value);
  if (!match) {
    throw new Error(
      'Invalid scene rule transition condition expression: ' +
      Reactodia.Rdf.termToString(expression)
    );
  }
  const [, name, operator, value] = match;
  return {
    name,
    operator: (
      operator === '=' ? 'EQ' :
      operator === '>' ? 'GT' :
      operator === '>=' ? 'GE' :
      operator === '<' ? 'LT' :
      operator === '<=' ? 'LE' :
      operator as SceneRuleCondition['operator']
    ),
    value: Number(value),
  };
}

function frameRule(data: Reactodia.LinkModel): SceneRule {
  const weightValues = data.properties[app.weight];
  const weightValue = weightValues && weightValues.length === 1 ? weightValues[0] : undefined;
  const weight = weightValue && weightValue.termType === 'Literal' ? Number(weightValue.value) : undefined;

  const conditions: SceneRuleCondition[] = [];
  const conditionValues = data.properties[app.condition];
  if (conditionValues) {
    for (const conditionValue of conditionValues) {
      if (conditionValue.termType === 'Literal' && conditionValue.datatype.value === app.RuleCondition) {
        conditions.push(deserializeCondition(conditionValue));
      }
    }
  }

  return {
    current_scene: Reactodia.Rdf.getLocalName(data.sourceId) ?? data.sourceId,
    result_scene: Reactodia.Rdf.getLocalName(data.targetId) ?? data.targetId,
    weight: weight ?? 1,
    params: conditions,
  };
}

export function sceneIri(sceneId: string): Reactodia.ElementIri {
  return `${app.$namespace}scene:${sceneId}`;
}

export function applyRuleChanges(rules: readonly SceneRule[], state: Reactodia.AuthoringState): SceneRule[] {
  const changedRules: SceneRule[] = [];

  for (const rule of rules) {
    const ruleKey: Reactodia.LinkKey = {
      sourceId: sceneIri(rule.current_scene),
      targetId: sceneIri(rule.result_scene),
      linkTypeId: app.to,
    };

    if (Reactodia.AuthoringState.isDeletedRelation(state, ruleKey)) {
      continue;
    }

    const ruleEvent = state.links.get(ruleKey);
    changedRules.push(
      ruleEvent?.type === 'relationChange'
        ? { ...rule, ...frameRule(ruleEvent.data) }
        : rule
    );
  }

  for (const event of state.links.values()) {
    if (event.type === 'relationAdd') {
      changedRules.push(frameRule(event.data));
    }
  }

  const renamedFromToScenes = new Map<string, string>();
  for (const event of state.elements.values()) {
    if (event.type === 'entityChange' && event.newIri !== undefined) {
      renamedFromToScenes.set(
        Reactodia.Rdf.getLocalName(event.before.id) ?? event.before.id,
        Reactodia.Rdf.getLocalName(event.newIri) ?? event.newIri
      );
    }
  }

  for (let i = 0; i < changedRules.length; i++) {
    const rule = changedRules[i];
    const renamedCurrent = renamedFromToScenes.get(rule.current_scene);
    const renamedResult = renamedFromToScenes.get(rule.result_scene);
    if (renamedCurrent !== undefined || renamedResult !== undefined) {
      changedRules[i] = {
        ...rule,
        current_scene: renamedCurrent ?? rule.current_scene,
        result_scene: renamedResult ?? rule.result_scene,
      };
    }
  }

  return changedRules;
}

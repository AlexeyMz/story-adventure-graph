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
      factory.namedNode(`${app.Namespace}scene:${scene}`),
      typePredicate,
      sceneType
    ));
  }

  const conditionPredicate = factory.namedNode(app.condition);
  const toPredicate = factory.namedNode(app.to);
  const weightPredicate = factory.namedNode(app.weight);

  for (const rule of rules) {
    const ruleQuad = factory.quad(
      factory.namedNode(`${app.Namespace}scene:${rule.current_scene}`),
      toPredicate,
      factory.namedNode(`${app.Namespace}scene:${rule.result_scene}`)
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

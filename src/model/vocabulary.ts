import * as Reactodia from '@reactodia/workspace';

const APP_NAMESPACE = 'urn:story-adventure:';
export const app = {
  Namespace: APP_NAMESPACE,
  Scene: `${APP_NAMESPACE}Scene`,
  RuleCondition: `${APP_NAMESPACE}RuleCondition`,
  condition: `${APP_NAMESPACE}condition`,
  to: `${APP_NAMESPACE}to`,
  weight: `${APP_NAMESPACE}weight`,
} as const;

export const rdf = Reactodia.rdf;

export const rdfs = {
  ...Reactodia.rdfs,
  Class: `${Reactodia.rdfs.$namespace}Class`,
} as const;

export const xsd = {
  ...Reactodia.xsd,
  double: `${Reactodia.xsd.$namespace}double`,
} as const;

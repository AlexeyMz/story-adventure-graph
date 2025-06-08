import * as Reactodia from '@reactodia/workspace';

import { app, xsd } from './vocabulary';

export class SceneMetadataProvider extends Reactodia.EmptyMetadataProvider {
  readonly factory: Reactodia.Rdf.DataFactory;

  constructor(options: {
    factory: Reactodia.Rdf.DataFactory;
  }) {
    super();
    this.factory = options.factory;
  }

  async canModifyEntity(
    entity: Reactodia.ElementModel,
    _options: { readonly signal?: AbortSignal; }
  ): Promise<Reactodia.MetadataCanModifyEntity> {
    const isScene = entity.types.includes(app.Scene);
    return {
      canChangeIri: isScene,
      canEdit: isScene,
      canDelete: isScene,
    };
  }

  async canModifyRelation(
    link: Reactodia.LinkModel,
    _source: Reactodia.ElementModel,
    _target: Reactodia.ElementModel,
    _options: { readonly signal?: AbortSignal; }
  ): Promise<Reactodia.MetadataCanModifyRelation> {
    const isTransition = link.linkTypeId === app.to;
    return {
      canChangeType: isTransition,
      canEdit: isTransition,
      canDelete: isTransition,
    };
  }

  async filterConstructibleTypes(
    types: ReadonlySet<Reactodia.ElementTypeIri>,
    _options: { readonly signal?: AbortSignal; }
  ): Promise<ReadonlySet<Reactodia.ElementTypeIri>> {
    return new Set(Array.from(types).filter(type => type === app.Scene));
  }

  async createEntity(
    type: Reactodia.ElementTypeIri,
    _options: { readonly signal?: AbortSignal; }
  ): Promise<Reactodia.ElementModel> {
    const id = 'scene' + String(Math.floor(100000 * (1 + Math.random()))).substring(1);
    return {
      id: type === app.Scene ? `${app.Namespace}scene:${id}` : `${app.Namespace}entity:${id}`,
      types: [app.Scene],
      properties: {},
    };
  }

  async canConnect(
    source: Reactodia.ElementModel,
    target: Reactodia.ElementModel | undefined,
    linkType: Reactodia.LinkTypeIri | undefined,
    _options: { readonly signal?: AbortSignal; }
  ): Promise<Reactodia.MetadataCanConnect[]> {
    if (
      source.types.includes(app.Scene) &&
      (!target || target.types.includes(app.Scene)) &&
      (!linkType || linkType === app.to)
    ) {
      return [
        {
          targetTypes: new Set([app.Scene]),
          inLinks: [app.to],
          outLinks: [app.to],
        }
      ];
    }

    return [];
  }

  async getRelationShape(
    linkType: Reactodia.LinkTypeIri,
    _options: { readonly signal?: AbortSignal; }
  ): Promise<Reactodia.MetadataRelationShape> {
    const properties = new Map<Reactodia.PropertyTypeIri, Reactodia.MetadataPropertyShape>();
    if (linkType === app.to) {
      properties.set(app.weight, {
        valueShape: {
          termType: 'Literal',
          datatype: this.factory.namedNode(xsd.double),
        }
      });
      properties.set(app.condition, {
        valueShape: {
          termType: 'Literal',
          datatype: this.factory.namedNode(app.RuleCondition),
        }
      });
    }
    return { properties };
  }
}

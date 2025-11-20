import * as Reactodia from '@reactodia/workspace';

import { app, xsd } from './vocabulary';

export class SceneMetadataProvider extends Reactodia.BaseMetadataProvider {
  readonly factory: Reactodia.Rdf.DataFactory;

  constructor(options: {
    factory: Reactodia.Rdf.DataFactory;
  }) {
    super({
      canModifyEntity: async entity => {
        const isScene = entity.types.includes(app.Scene);
        return {
          canChangeIri: isScene,
          canEdit: isScene,
          canDelete: isScene,
        };
      },
      canModifyRelation: async link => {
        const isTransition = link.linkTypeId === app.to;
        return {
          canChangeType: isTransition,
          canEdit: isTransition,
          canDelete: isTransition,
        };
      },
      filterConstructibleTypes: async types => {
        return new Set(Array.from(types).filter(type => type === app.Scene));
      },
      createEntity: async type => {
        const id = 'scene' + String(Math.floor(100000 * (1 + Math.random()))).substring(1);
        return {
          data: {
            id: type === app.Scene ? `${app.$namespace}scene:${id}` : `${app.$namespace}entity:${id}`,
            types: [app.Scene],
            properties: {},
          },
        };
      },
      canConnect: async (source, target, linkType) => {
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
      },
      getRelationShape: async linkType => {
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
      },
    });
    this.factory = options.factory;
  }
}

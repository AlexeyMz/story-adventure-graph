import * as Reactodia from '@reactodia/workspace';

// TODO: move to Reactodia codebase
export function applyAuthoringState(context: Reactodia.WorkspaceContext): void {
  const { model, editor } = context;
  const state = editor.authoringState;

  const batch = model.history.startBatch();
  for (const event of state.links.values()) {
    if (event.type === 'relationChange') {
      batch.history.execute(Reactodia.changeRelationData(model, event.before, event.data));
    }
  }

  const removedLinks: Reactodia.Link[] = [];
  for (const link of model.links) {
    if (link instanceof Reactodia.RelationLink) {
      if (Reactodia.AuthoringState.isDeletedRelation(state, link.data)) {
        removedLinks.push(link);
      }
    } else if (link instanceof Reactodia.RelationGroup) {
      if (link.items.some(item => Reactodia.AuthoringState.isDeletedRelation(state, item.data))) {
        model.history.execute(Reactodia.setRelationGroupItems(
          link,
          link.items.filter(item => !Reactodia.AuthoringState.isDeletedRelation(state, item.data))
        ));
      }
    }
  }
  for (const link of removedLinks) {
    model.removeLink(link.id);
  }

  for (const event of state.elements.values()) {
    if (event.type === 'entityChange') {
      model.history.execute(Reactodia.changeEntityData(
        model,
        event.before.id,
        event.newIri === undefined ? event.data : {
          ...event.data,
          id: event.newIri,
        }
      ));
    }
  }

  const removedElements: Reactodia.Element[] = [];
  for (const element of model.elements) {
    if (element instanceof Reactodia.EntityElement) {
      if (Reactodia.AuthoringState.isDeletedEntity(state, element.iri)) {
        removedElements.push(element);
      }
    } else if (element instanceof Reactodia.EntityGroup) {
      if (element.items.some(item => Reactodia.AuthoringState.isDeletedEntity(state, item.data.id))) {
        batch.history.execute(Reactodia.setEntityGroupItems(
          element,
          element.items.filter(item => !Reactodia.AuthoringState.isDeletedEntity(state, item.data.id))
        ));
      }
    }
  }
  for (const element of removedElements) {
    model.removeElement(element.id);
  }

  editor.setAuthoringState(Reactodia.AuthoringState.empty);
  batch.store();
}

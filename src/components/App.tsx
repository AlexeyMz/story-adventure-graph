import * as React from 'react';
import * as Reactodia from '@reactodia/workspace';
import LayoutWorker from '@reactodia/workspace/layout.worker?worker';

import { applyAuthoringState } from '../model/applyAuthoringState';
import { SceneMetadataProvider } from '../model/metadataProvider';
import { type SceneRule, makeSceneSchema, sceneIri, rulesIntoQuads, applyRuleChanges } from '../model/sceneRules';
import { app } from '../model/vocabulary';

import { MainMenu } from './MainMenu';
import { RuleConditionInput } from './RuleConditionInput';
import './App.css';

const Layouts = Reactodia.defineLayoutWorker(() => new LayoutWorker());

interface DataSource {
  readonly sceneRulesJson: string;
  readonly initialLayout?: Reactodia.SerializedDiagram;
}

export function App() {
  const {defaultLayout} = Reactodia.useWorker(Layouts);

  const [dataSource, setDataSource] = React.useState<DataSource | null>(null);

  const {onMount, getContext} = Reactodia.useLoadedWorkspace(async ({context, signal}) => {
    const {model, editor, performLayout} = context;
    editor.setAuthoringMode(true);

    const dataProvider = new Reactodia.RdfDataProvider();
    dataProvider.addGraph(makeSceneSchema(dataProvider.factory));

    if (dataSource) {
      const sceneRules = parseRulesJson(dataSource.sceneRulesJson);
      dataProvider.addGraph(rulesIntoQuads(sceneRules, dataProvider.factory));

      await model.importLayout({dataProvider, diagram: dataSource.initialLayout, signal});

      const elements = (await dataProvider.lookup({elementTypeId: app.Scene}))
        .map(scene => model.createElement(scene.element));
      await Promise.all([
        model.requestElementData(elements.map(el => el.iri)),
        model.requestLinks(),
      ]);
      await performLayout({signal});
    } else {
      await model.importLayout({dataProvider});
    }
  }, [dataSource]);

  const [metadataProvider] = React.useState(() => new SceneMetadataProvider({
    factory: Reactodia.Rdf.DefaultDataFactory,
  }));

  return (
    <Reactodia.Workspace ref={onMount}
      defaultLayout={defaultLayout}
      metadataProvider={metadataProvider}
      translations={[
        {
          "visual_authoring": {
            "edit_entity.iri.label": "ID"
          }
        }
      ]}>
      <Reactodia.DefaultWorkspace
        menu={
          <MainMenu
            onOpen={jsonData => setDataSource({sceneRulesJson: jsonData})}
            onSave={() => {
              const { model, editor } = getContext();

              const initialRules = dataSource ? parseRulesJson(dataSource.sceneRulesJson) : [];
              const changedRules = applyRuleChanges(initialRules, editor.authoringState);
              const changedJson = JSON.stringify(changedRules, null, 4);

              applyAuthoringState(getContext());
              setDataSource({
                sceneRulesJson: changedJson,
                initialLayout: model.exportLayout(),
              });

              return changedJson;
            }}
          />
        }
        canvas={{
          elementTemplateResolver: elementType =>
            elementType.includes(app.Scene) ? Reactodia.RoundTemplate : undefined,
          linkTemplateResolver: linkType =>
            linkType === app.to ? LinkTemplate : undefined,
        }}
        canvasWidgets={[
          <Reactodia.Toolbar dock='s'>
            <Reactodia.ToolbarAction hotkey='None+S'
              title='Add a new scene to the graph'
              onSelect={async () => {
                const { editor, view, disposeSignal } = getContext();
                const data = await metadataProvider.createEntity(app.Scene, { signal: disposeSignal });
                const element = editor.createEntity(data);
                const canvas = view.findAnyCanvas()!;
                const position = canvas.metrics.clientToPaperCoords(
                  canvas.metrics.area.clientWidth / 2,
                  canvas.metrics.area.clientHeight / 2
                );
                element.setPosition(position);
                canvas.renderingState.syncUpdate();
                const {width, height} = Reactodia.boundsOf(element, canvas.renderingState);
                element.setPosition({
                  x: position.x - width / 2,
                  y: position.y - height / 2,
                });
              }}>
              + Add scene
            </Reactodia.ToolbarAction>
          </Reactodia.Toolbar>
        ]}
        visualAuthoring={{
          inputResolver: (property, inputProps) => {
            if (property === 'urn:reactodia:entityIri') {
              return <SceneNameInput {...inputProps} />;
            } else if (property === app.condition) {
              return (
                <Reactodia.FormInputList {...inputProps} valueInput={RuleConditionInput} />
              );
            }
            return undefined;
          }
        }}
      />
    </Reactodia.Workspace>
  );
}

const LinkTemplate: Reactodia.LinkTemplate = {
  ...Reactodia.DefaultLinkTemplate,
  renderLink: props => (
    <Reactodia.DefaultLink {...props}
      primaryLabelProps={{style: {display: 'none'}}}
    />
  ),
};

function SceneNameInput(props: Reactodia.FormInputMultiProps) {
  const {values, updateValues, factory} = props;

  const sceneNameValues = React.useMemo(() => deriveSceneName(values, factory), [values, factory]);
  const sceneNameUpdate = React.useCallback((updater: Reactodia.FormInputMultiUpdater) => {
    updateValues(previous => {
      const nextValues = updater(deriveSceneName(previous, factory));
      return nextValues.map(term => factory.namedNode(sceneIri(term.value)));
    });
  }, [updateValues, factory]);

  return (
    <Reactodia.FormInputList {...props}
      values={sceneNameValues}
      updateValues={sceneNameUpdate}
      valueInput={Reactodia.FormInputText}
    />
  );
}

function deriveSceneName(
  values: ReadonlyArray<Reactodia.Rdf.NamedNode | Reactodia.Rdf.Literal>,
  factory: Reactodia.Rdf.DataFactory
) {
  return values.map(term => factory.literal(Reactodia.Rdf.getLocalName(term.value) ?? term.value));
}

function parseRulesJson(sceneRulesJson: string): SceneRule[] {
  try {
    const sceneRules: SceneRule[] = JSON.parse(sceneRulesJson);
    return sceneRules;
  } catch (err) {
    throw new Error('Error parsing scene rules graph', {cause: err});
  }
}
